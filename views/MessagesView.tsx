import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { AccessibleModal } from '../components/AccessibleModal';
import { Send, ChevronLeft, MoreVertical, Sparkles, ArrowLeft, MapPin, MessageSquare } from 'lucide-react';
import { generateSmartReplies, createSmartReplyRequestKey } from '../services/geminiService';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, orderBy, serverTimestamp, getDoc, getDocs, limit, startAfter, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { moderateMessage } from '../utils/moderation';
import { reportCriticalActionFailure } from '../utils/errorReporting';
import { t, useLang } from '../i18n';

interface MessagesViewProps {
  user: any;
  activeChatContext: { userId: string; context: string } | null;
  onBack: () => void;
}

// Realtime window size for the newest messages in an open conversation —
// older history is loaded explicitly via loadOlderMessages(). Current
// production p90 is 7 messages/chat, so 30 comfortably covers virtually
// every conversation today while bounding initial read/render cost as
// conversations age. Not user-configurable.
const MESSAGE_PAGE_SIZE = 30;

// Prepending older history must not visually yank the viewport — restoring
// scrollTop to the same point in the (now taller) content preserves the
// reader's position. Exported as a pure function so the formula itself can
// be pinned directly without simulating a fake browser layout.
export function computeRestoredScrollTop(prevScrollTop: number, prevScrollHeight: number, newScrollHeight: number): number {
  return prevScrollTop + (newScrollHeight - prevScrollHeight);
}

export const MessagesView: React.FC<MessagesViewProps> = ({ user, activeChatContext, onBack }) => {
  useLang();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    activeChatContext && user ? [user.id, activeChatContext.userId].sort().join('_') : null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [moderationError, setModerationError] = useState('');
  const [sending, setSending] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSmartReplyKey = useRef<string | null>(null);

  // ── Bounded message history pagination ──────────────────────────────
  // retainedMessagesRef accumulates every message this session has loaded
  // for the active conversation (live + explicitly paginated) — it is the
  // source of truth for what's displayed (`messages`, derived below) and
  // is NEVER pruned by a live-query 'removed' event. liveWindowIdsRef only
  // tracks which IDs currently sit inside the realtime newest-window query,
  // purely to interpret 'removed' vs 'added'/'modified' — a message leaving
  // the live window (pushed out by a newer one) and a message being
  // deleted server-side (mid deleteChat) produce the identical event, and
  // the only safe way to tell them apart is to wait for the
  // conversations-list listener to report the whole chat gone.
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const retainedMessagesRef = useRef<Map<string, any>>(new Map());
  const liveWindowIdsRef = useRef<Set<string>>(new Set());
  const oldestLoadedCursorRef = useRef<any>(null);
  const conversationGenerationRef = useRef(0);
  const isLoadingOlderRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestoreRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null);
  const suppressAutoScrollRef = useRef(false);
  const prevConversationIdsRef = useRef<Set<string>>(new Set());

  const toMessage = (docSnap: any) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      senderId: data.senderId,
      text: data.text || '',
      timestamp: data.timestamp?.toDate() || new Date(),
      isMe: data.senderId === user?.id,
    };
  };
  const sortedRetainedMessages = () =>
    Array.from(retainedMessagesRef.current.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const [userProfilesCache, setUserProfilesCache] = useState<Record<string, { name: string; avatarUrl: string | null }>>({});
  // Mirrors userProfilesCache so the hydration effect below always checks
  // the freshest cache membership rather than a closure captured at the
  // point this effect last re-ran (deps are [conversations, db], not
  // userProfilesCache).
  const userProfilesCacheRef = useRef(userProfilesCache);
  useEffect(() => { userProfilesCacheRef.current = userProfilesCache; }, [userProfilesCache]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const reportCancelRef = useRef<HTMLButtonElement>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Server-mediated deletion (see functions/index.js deleteChat) — the
  // client no longer enumerates or batch-deletes messages itself, so
  // deletion cost/client work no longer grows with conversation length.
  const doDeleteChat = async () => {
    if (!activeConversationId || deletingChat) return;
    setDeletingChat(true);
    try {
      const functions = getFunctions(getApp(), 'us-central1');
      await httpsCallable(functions, 'deleteChat')({ chatId: activeConversationId });
      setActiveConversationId(null);
    } catch (e) {
      console.error("Error deleting chat:", e);
      // Single generic path for every failure here (no business-rule branching
      // to exclude) — client-side reporting is the only signal for failures
      // that never reach the callable at all (network/App Check).
      reportCriticalActionFailure('chat_delete', e);
      showToast(t('messages.toast_delete_failed'));
    } finally {
      setDeletingChat(false);
      setShowDeleteConfirm(false);
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [actionToast, setActionToast] = useState('');

  const showToast = (msg: string) => { setActionToast(msg); setTimeout(() => setActionToast(''), 3000); };

  // Report reasons: value written to Firestore (English stays), label is translated display
  const reportReasons = [
    { value: 'Harassment or abuse', label: t('messages.report_harassment') },
    { value: 'Inappropriate messages', label: t('messages.report_inappropriate') },
    { value: 'Spam', label: t('messages.report_spam') },
    { value: 'Scam or fraud', label: t('messages.report_scam') },
    { value: 'Other', label: t('messages.report_other') },
  ];

  const closeDeleteConfirm = () => {
    if (deletingChat) return;
    setShowDeleteConfirm(false);
  };

  const handleBlockUser = async () => {
    if (!activeConversation) return;
    const otherUserId = activeConversation.otherUser.id;
    try {
      const currentBlocked = user.blockedUsers || [];
      if (!currentBlocked.includes(otherUserId)) {
        await updateDoc(doc(db, "users", user.id, "private", "social"), {
          blockedUsers: [...currentBlocked, otherUserId]
        });
      }
      showToast(t('messages.toast_blocked'));
      setActiveConversationId(null);
    } catch (e) {
      console.error("Error blocking user:", e);
      showToast(t('messages.toast_block_failed'));
    }
  };

  const handleReportUser = async (reason: string) => {
    if (!activeConversation || !reason.trim()) return;
    const otherUserId = activeConversation.otherUser.id;
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: user.id,
        reportedUserId: otherUserId,
        type: 'behavior',
        reason: reason.trim(),
        status: 'pending',
        conversationId: activeConversationId,
        createdAt: serverTimestamp()
      });
      showToast(t('messages.toast_reported'));
      setShowReportModal(false);
    } catch (e) {
      console.error("Error reporting user:", e);
      showToast(t('messages.toast_report_failed'));
    }
  };

  // Dynamic User Profile Resolver & Cache to fix 'User' / 'Anonymous' fallback issues.
  // Missing partner profiles are fetched concurrently (Promise.all) instead
  // of one getDoc per uid awaited in series — same bounded set of reads,
  // shorter critical path (max of the individual round-trips instead of
  // their sum).
  useEffect(() => {
    if (conversations.length === 0 || !db) return;

    const missingUserIds = Array.from(new Set(
      conversations
        .map(c => c.otherUser.id)
        .filter(id => id && !userProfilesCacheRef.current[id])
    ));

    if (missingUserIds.length === 0) return;

    let cancelled = false;

    Promise.all(missingUserIds.map(async uid => {
      try {
        const userDocSnap = await getDoc(doc(db, "users", uid));
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          return [uid, { name: data.fullName || '', avatarUrl: data.avatarUrl || null }] as const;
        }
      } catch (e) {
        console.warn("Failed to fetch user profile for cache:", uid, e);
      }
      return null;
    })).then(results => {
      if (cancelled) return;
      const entries = results.filter((r): r is readonly [string, { name: string; avatarUrl: string | null }] => r !== null);
      if (entries.length === 0) return;
      // Functional update — merges against whatever userProfilesCache is at
      // apply-time, so a slower, earlier-started hydration resolving after a
      // faster, later one cannot clobber entries the later one already added.
      setUserProfilesCache(prev => {
        const next = { ...prev };
        entries.forEach(([uid, val]) => { next[uid] = val; });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [conversations, db]);

  // 1. Fetch conversations list for user
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.id)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(docSnap => {
        const data = docSnap.data();
        const otherUserId = data.participants.find((p: string) => p !== user.id) || '';
        // Display name always comes from the live users/{uid}.fullName
        // lookup (userProfilesCache, populated by the effect below) —
        // participantNames no longer exists in the schema.

        let timestampDate = new Date();
        if (data.lastMessageTimestamp) {
          if (typeof data.lastMessageTimestamp.toDate === 'function') {
            timestampDate = data.lastMessageTimestamp.toDate();
          } else {
            timestampDate = new Date(data.lastMessageTimestamp);
          }
        }

        return {
          ...data,
          id: docSnap.id,
          otherUser: { id: otherUserId },
          lastMessage: data.lastMessage || '',
          lastMessageTimestamp: timestampDate,
          unreadCount: 0,
          relatedSpotTitle: data.relatedSpotTitle || ''
        };
      });
      // Sort desc by last message timestamp
      list.sort((a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime());

      const blockedList = user?.blockedUsers || [];
      const filteredList = list.filter(conv => !blockedList.includes(conv.otherUser.id));
      setConversations(filteredList);
    });
    return () => unsubscribe();
  }, [user?.id, JSON.stringify(user?.blockedUsers)]);

  // 2. Handle activeChatContext passed from spot click
  useEffect(() => {
    if (!user || !activeChatContext || !db) return;

    const initChat = async () => {
      const chatId = [user.id, activeChatContext.userId].sort().join("_");
      const chatRef = doc(db, "chats", chatId);

      // Chat shell (id/participants/relatedSpotTitle) is create-once — the
      // chats/{chatId} Rules deny direct client update entirely, so a
      // re-navigation to an already-existing conversation must not attempt
      // to write anything at all. participantNames is no longer part of the
      // schema: display names are always sourced live from users/{uid}.
      // fullName (see the conversation-list effect below), so there is
      // nothing left for this function to fetch or cache. See
      // docs/CHAT_SHELL_METADATA_HARDENING.md.
      const existing = await getDoc(chatRef);
      if (!existing.exists()) {
        await setDoc(chatRef, {
          id: chatId,
          participants: [user.id, activeChatContext.userId],
          relatedSpotTitle: activeChatContext.context || "Street Spot",
        });
      }

      setActiveConversationId(chatId);
    };

    initChat();
  }, [user?.id, activeChatContext]);

  // 3. Listen to the newest MESSAGE_PAGE_SIZE messages for the active
  // conversation in realtime; older history is loaded explicitly via
  // loadOlderMessages(). See the state block above for the
  // retainedMessagesRef/liveWindowIdsRef contract.
  useEffect(() => {
    retainedMessagesRef.current = new Map();
    liveWindowIdsRef.current = new Set();
    oldestLoadedCursorRef.current = null;
    conversationGenerationRef.current++;
    const myGeneration = conversationGenerationRef.current;
    isLoadingOlderRef.current = false;
    setMessages([]);
    setHasMoreOlder(false);
    setIsLoadingOlder(false);

    if (!activeConversationId || !user || !db) {
      return;
    }

    const q = query(
      collection(db, "chats", activeConversationId, "messages"),
      orderBy("timestamp", "desc"),
      limit(MESSAGE_PAGE_SIZE)
    );

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, (snap) => {
      // Defensive guard: real Firestore never invokes a callback after
      // unsubscribe(), but this protects against that assumption anyway —
      // a callback whose generation has since moved on (conversation
      // switched, or the effect re-ran) must never mutate the current
      // conversation's state.
      if (conversationGenerationRef.current !== myGeneration) return;

      const retained = retainedMessagesRef.current;
      const liveIds = liveWindowIdsRef.current;

      snap.docChanges().forEach((change: any) => {
        if (change.type === 'removed') {
          // Window eviction OR server-mediated whole-chat deletion in
          // progress — never inferred from this event alone. Only stop
          // tracking membership in the live window; retained history stays
          // until the conversations-list listener says the whole chat is
          // gone (see the effect below).
          liveIds.delete(change.doc.id);
          return;
        }
        const msg = toMessage(change.doc);
        retained.set(msg.id, msg);
        liveIds.add(msg.id);
      });

      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        // The historical pagination boundary — oldest document actually
        // returned by THIS initial page. Never moved forward by later
        // window eviction; only ever advanced by a successful
        // loadOlderMessages() page.
        if (snap.docs.length > 0) {
          oldestLoadedCursorRef.current = snap.docs[snap.docs.length - 1];
        }
        setHasMoreOlder(snap.docs.length === MESSAGE_PAGE_SIZE);
      }

      setMessages(sortedRetainedMessages());
    });

    return () => {
      unsubscribe();
      // Invalidates any in-flight loadOlderMessages() request captured
      // against this generation, whether due to a conversation switch or a
      // full component unmount.
      conversationGenerationRef.current++;
    };
  }, [activeConversationId, user?.id]);

  // If the active conversation disappears from the participant's own chats
  // list (deleted by either participant via deleteChat), exit the detail
  // view — the effect above then tears down the message listener and
  // resets pagination state as part of its own activeConversationId
  // change. Guarded against "not yet arrived" (a brand-new conversation)
  // by only clearing when the id was PREVIOUSLY present and is now gone —
  // never inferred from a message-level 'removed' event.
  useEffect(() => {
    const currentIds = new Set(conversations.map(c => c.id));
    if (
      activeConversationId &&
      prevConversationIdsRef.current.has(activeConversationId) &&
      !currentIds.has(activeConversationId)
    ) {
      setActiveConversationId(null);
    }
    prevConversationIdsRef.current = currentIds;
  }, [conversations, activeConversationId]);

  const loadOlderMessages = async () => {
    if (!activeConversationId || !hasMoreOlder || isLoadingOlderRef.current || !oldestLoadedCursorRef.current) return;
    const myGeneration = conversationGenerationRef.current;
    const cursor = oldestLoadedCursorRef.current;
    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const q = query(
        collection(db, "chats", activeConversationId, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(cursor),
        limit(MESSAGE_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (conversationGenerationRef.current !== myGeneration) return; // stale — conversation switched or unmounted

      snap.docs.forEach((docSnap: any) => {
        const msg = toMessage(docSnap);
        retainedMessagesRef.current.set(msg.id, msg);
      });
      if (snap.docs.length > 0) {
        oldestLoadedCursorRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMoreOlder(snap.docs.length === MESSAGE_PAGE_SIZE);

      const container = messagesContainerRef.current;
      if (container) {
        pendingScrollRestoreRef.current = { prevScrollTop: container.scrollTop, prevScrollHeight: container.scrollHeight };
      }
      suppressAutoScrollRef.current = true;
      setMessages(sortedRetainedMessages());
    } catch (e) {
      console.error("Error loading earlier messages:", e);
      showToast(t('messages.toast_load_earlier_failed'));
      // Already-loaded history, cursor, and hasMoreOlder are left exactly
      // as they were — retry remains possible via the still-visible control.
    } finally {
      if (conversationGenerationRef.current === myGeneration) {
        isLoadingOlderRef.current = false;
        setIsLoadingOlder(false);
      }
    }
  };

  // Restores the reader's visual position after prepending older history —
  // runs before paint, so no scroll jump is visible.
  useLayoutEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (pending && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = computeRestoredScrollTop(pending.prevScrollTop, pending.prevScrollHeight, container.scrollHeight);
      pendingScrollRestoreRef.current = null;
    }
  }, [messages]);

  // Update last read timestamp in localStorage when active chat receives messages
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(`lastReadChat_${activeConversationId}`, Date.now().toString());
    }
    setIsMenuOpen(false);
  }, [activeConversationId, messages.length]);

  // 4. Auto-scroll to bottom on initial open / a new live message — NOT on
  // a loadOlderMessages() prepend (suppressed above via suppressAutoScrollRef).
  useEffect(() => {
    if (suppressAutoScrollRef.current) {
      suppressAutoScrollRef.current = false;
      return;
    }
    if (activeConversationId && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeConversationId]);

  // Trigger Smart Replies
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.isMe) {
        const key = createSmartReplyRequestKey(activeConversationId, lastMsg.id);
        if (key !== lastSmartReplyKey.current) {
          lastSmartReplyKey.current = key;
          let active = true;
          generateSmartReplies(lastMsg.text, activeConversation?.relatedSpotTitle || "Parking Spot")
            .then(replies => { if (active) setSmartReplies(replies); })
            .catch(err => {
              console.warn("Gemini smart replies failed", err);
              if (active) setSmartReplies([]);
              // Clear key on failure so the next render can retry
              if (lastSmartReplyKey.current === key) lastSmartReplyKey.current = null;
            });
          return () => { active = false; };
        }
      } else {
        setSmartReplies([]);
      }
    }
  }, [messages, activeConversationId]);

  // 5. Send message
  const handleSend = async (text: string) => {
    if (!text.trim() || !activeConversationId || !user || !db || sending) return;
    setModerationError('');

    // UX-only pre-check for instant feedback — NOT a security boundary.
    // sendMessage independently re-runs the authoritative check server-side;
    // a client that skipped this call entirely would gain no bypass.
    const blocked = moderateMessage(text.trim());
    if (blocked) {
        setModerationError(blocked);
        setTimeout(() => setModerationError(''), 4000);
        return;
    }

    const trimmed = text.trim();
    setSending(true);
    try {
        const functions = getFunctions(getApp(), 'us-central1');
        const clientRequestId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await httpsCallable(functions, 'sendMessage')({
            chatId: activeConversationId,
            clientRequestId,
            text: trimmed,
        });
        localStorage.setItem(`lastReadChat_${activeConversationId}`, Date.now().toString());
        setInputText('');
        setSmartReplies([]);
    } catch (e: any) {
        const code: string = e?.code ?? '';
        if (code === 'functions/invalid-argument') {
            // Server-side moderation rejection — same banner UX as the
            // client-side pre-check above, same non-localized copy for parity.
            setModerationError(e?.message || "This message couldn't be sent. Please revise and try again.");
            setTimeout(() => setModerationError(''), 4000);
        } else if (code === 'functions/resource-exhausted') {
            setModerationError(t('messages.rate_limited'));
            setTimeout(() => setModerationError(''), 4000);
        } else {
            // Genuinely unexpected — the moderation/rate-limit branches above are
            // expected, well-understood outcomes with their own server-side
            // trail; this catch-all is the only class of failure (network,
            // App Check, internal) with no guaranteed diagnostic trail.
            console.error("Error sending message", e);
            reportCriticalActionFailure('message_send', e, code ? { errorCode: code } : undefined);
            showToast(t('messages.toast_send_failed'));
        }
    } finally {
        setSending(false);
    }
  };

  if (activeConversationId && activeConversation) {
    const displayName = userProfilesCache[activeConversation.otherUser.id]?.name
      || t('messages.anonymous');

    return (
      <div className="h-full flex flex-col bg-[var(--color-bg)] pt-4 pb-20">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            <button onClick={() => activeChatContext ? onBack() : setActiveConversationId(null)} aria-label={t('messages.back_chat_aria')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
              <ChevronLeft size={24} />
            </button>
            <div className="w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-gray-500 overflow-hidden shrink-0">
               {userProfilesCache[activeConversation.otherUser.id]?.avatarUrl ? (
                 <img src={userProfilesCache[activeConversation.otherUser.id].avatarUrl!} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <i className="fa-solid fa-user text-xl"></i>
               )}
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text)]">{displayName}</h3>
              {activeConversation.relatedSpotTitle && (
                <p className="text-xs text-queen-400">{activeConversation.relatedSpotTitle}</p>
              )}
            </div>
          </div>
          <div className="relative">
            <button ref={menuTriggerRef} onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={t('messages.menu_aria')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-2 hover:bg-white/5 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                  <button
                    onClick={() => { setIsMenuOpen(false); setShowDeleteConfirm(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                  >
                    {t('messages.delete_chat')}
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); handleBlockUser(); }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--color-text)] hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                  >
                    {t('messages.block_user')}
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); setShowReportModal(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--color-text)] hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                  >
                    {t('messages.report_user')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {hasMoreOlder && (
            <button
              onClick={loadOlderMessages}
              disabled={isLoadingOlder}
              aria-label={t('messages.load_earlier')}
              className="w-full text-center text-xs text-[var(--color-text-secondary)] py-2 disabled:opacity-50"
            >
              {isLoadingOlder ? t('messages.loading_earlier') : t('messages.load_earlier')}
            </button>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.isMe
                  ? 'bg-queen-600 text-white rounded-br-none'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-bl-none'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className="text-[10px] opacity-50 mt-1 text-right">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Smart Replies */}
        {smartReplies.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center text-queen-400 mr-1">
                <Sparkles size={16} />
            </div>
            {smartReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(reply)}
                className="whitespace-nowrap bg-[var(--color-surface)] border border-queen-500/30 text-queen-100 text-xs px-3 py-1.5 rounded-full hover:bg-queen-900/40 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {actionToast && (
          <div className="px-4 py-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
            <p className="text-emerald-400 text-xs text-center font-semibold">{actionToast}</p>
          </div>
        )}

        {showDeleteConfirm && (
          <AccessibleModal
            ariaLabel={t('messages.delete_confirm_title')}
            initialFocusRef={deleteCancelRef}
            returnFocusRef={menuTriggerRef}
            onDismiss={deletingChat ? undefined : closeDeleteConfirm}
            overlayClassName="absolute inset-0 z-50 bg-black/50 flex items-end justify-center pb-10"
            panelClassName="bg-[var(--color-surface)] rounded-3xl p-6 mx-4 w-full max-w-sm border border-[var(--color-border)] shadow-2xl"
          >
              <p className="text-base font-bold text-[var(--color-text)] text-center mb-1">{t('messages.delete_confirm_title')}</p>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6">{t('messages.delete_confirm_body')}</p>
              <div className="flex gap-3">
                <button ref={deleteCancelRef} onClick={closeDeleteConfirm} className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-sm">
                  {t('messages.cancel')}
                </button>
                <button onClick={doDeleteChat} disabled={deletingChat} className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm disabled:opacity-50">
                  {t('messages.delete')}
                </button>
              </div>
          </AccessibleModal>
        )}

        {showReportModal && (
          <AccessibleModal
            ariaLabel={t('messages.report_title')}
            initialFocusRef={reportCancelRef}
            returnFocusRef={menuTriggerRef}
            onDismiss={() => setShowReportModal(false)}
            overlayClassName="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            panelClassName="bg-[var(--color-surface)] rounded-3xl p-5 w-full max-w-sm border border-[var(--color-border)] shadow-2xl"
          >
              <h3 className="font-bold text-[var(--color-text)] mb-3">{t('messages.report_title')}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">{t('messages.report_subtitle')}</p>
              <div className="space-y-2">
                {reportReasons.map(({ value, label }) => (
                  <button key={value} onClick={() => handleReportUser(value)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all text-[var(--color-text)] text-left px-4">
                    {label}
                  </button>
                ))}
              </div>
              <button ref={reportCancelRef} onClick={() => setShowReportModal(false)}
                className="w-full mt-3 text-[var(--color-text-secondary)] text-sm text-center py-2">
                {t('messages.cancel')}
              </button>
          </AccessibleModal>
        )}

        {moderationError && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-red-400 text-xs text-center">{moderationError}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-full px-4 py-2 border border-[var(--color-border)] focus-within:border-queen-500 transition-colors">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('messages.type_placeholder')}
              className="flex-1 bg-transparent border-none outline-none text-[var(--color-text)] text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
            />
            <button
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim() || sending}
              className="p-2 bg-queen-600 rounded-full text-white disabled:opacity-50 disabled:bg-[var(--color-surface)]"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avatarGradients = [
    'linear-gradient(135deg,#1e3a5f,#1e40af)',
    'linear-gradient(135deg,#1a2e1a,#14532d)',
    'linear-gradient(135deg,#2e1a2e,#581c87)',
    'linear-gradient(135deg,#3b2a1a,#92400e)',
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] pt-4 pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 mb-6">
        {onBack && (
          <button onClick={onBack} aria-label={t('messages.back_aria')} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">{t('messages.title')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('messages.subtitle')}</p>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-3 no-scrollbar">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#1e75ff]/10 border border-[#1e75ff]/15 flex items-center justify-center text-[#1e75ff] mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-[var(--color-text-secondary)] font-bold text-sm mb-1.5">{t('messages.empty')}</h3>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed opacity-60">{t('messages.empty_hint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(conv => {
              const lastReadStr = localStorage.getItem(`lastReadChat_${conv.id}`);
              const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;
              const hasUnread = conv.lastMessageTimestamp.getTime() > lastReadTime && conv.lastSenderId !== user.id;
              const convDisplayName = userProfilesCache[conv.otherUser.id]?.name
                || t('messages.anonymous');
              const initial = convDisplayName.charAt(0).toUpperCase();
              const avatarBg = avatarGradients[initial.charCodeAt(0) % avatarGradients.length];

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`w-full border rounded-2xl p-3.5 flex items-center gap-3 text-left transition-all active:scale-[0.99] ${hasUnread ? 'bg-[#0d1f35] border-[#1e75ff]/20' : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-white/[0.03]'}`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {userProfilesCache[conv.otherUser.id]?.avatarUrl ? (
                      <img src={userProfilesCache[conv.otherUser.id].avatarUrl!} alt={convDisplayName} className="w-11 h-11 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#93c5fd] font-bold text-base" style={{ background: avatarBg }}>
                        {initial}
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#1e75ff] border-2 border-[var(--color-bg)] rounded-full" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-sm truncate pr-2 ${hasUnread ? 'font-extrabold text-[var(--color-text)]' : 'font-semibold text-[var(--color-text-secondary)]'}`}>
                        {convDisplayName}
                      </span>
                      <span className="text-[11px] text-gray-500 shrink-0">
                        {conv.lastMessageTimestamp instanceof Date
                          ? conv.lastMessageTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : t('messages.just_now')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs truncate pr-2 ${hasUnread ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-text-secondary)] opacity-60'}`}>
                        {conv.lastMessage}
                      </p>
                      {hasUnread && (
                        <span className="flex items-center justify-center bg-[#1e75ff] text-white text-[9px] font-bold rounded-full shrink-0" style={{ width: 18, height: 18 }}>
                          1
                        </span>
                      )}
                    </div>

                    {conv.relatedSpotTitle && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-[#38bdf8] bg-[#1e75ff]/10 border border-[#38bdf8]/15 px-2 py-0.5 rounded-full">
                        <MapPin size={9} className="text-[#38bdf8] shrink-0" />
                        <span className="truncate max-w-[160px]">{conv.relatedSpotTitle}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            <div className="py-4 text-center">
              <p className="text-[11px] text-[#334155]">{t('messages.all_caught_up')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
