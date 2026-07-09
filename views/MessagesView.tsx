import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronLeft, MoreVertical, Sparkles, ArrowLeft, MapPin, MessageSquare } from 'lucide-react';
import { generateSmartReplies } from '../services/geminiService';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc, orderBy, serverTimestamp, getDocs, getDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { moderateMessage } from '../utils/moderation';

interface MessagesViewProps {
  user: any;
  activeChatContext: { userId: string; context: string } | null;
  onBack: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ user, activeChatContext, onBack }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [moderationError, setModerationError] = useState('');
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userProfilesCache, setUserProfilesCache] = useState<Record<string, { name: string; avatarUrl: string | null }>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const doDeleteChat = async () => {
    if (!activeConversationId) return;
    setShowDeleteConfirm(false);
    try {
      const msgsRef = collection(db, "chats", activeConversationId, "messages");
      const snap = await getDocs(msgsRef);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "chats", activeConversationId));
      await batch.commit();
      setActiveConversationId(null);
    } catch (e) {
      console.error("Error deleting chat:", e);
      showToast('Failed to delete conversation.');
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [actionToast, setActionToast] = useState('');

  const showToast = (msg: string) => { setActionToast(msg); setTimeout(() => setActionToast(''), 3000); };

  const handleBlockUser = async () => {
    if (!activeConversation) return;
    const otherUserId = activeConversation.otherUser.id;
    try {
      const currentBlocked = user.blockedUsers || [];
      if (!currentBlocked.includes(otherUserId)) {
        await updateDoc(doc(db, "users", user.id), {
          blockedUsers: [...currentBlocked, otherUserId]
        });
      }
      showToast('User blocked');
      setActiveConversationId(null);
    } catch (e) {
      console.error("Error blocking user:", e);
      showToast('Failed to block user');
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
      showToast('Report submitted. Thank you.');
      setShowReportModal(false);
    } catch (e) {
      console.error("Error reporting user:", e);
      showToast('Failed to submit report');
    }
  };

  // Dynamic User Profile Resolver & Cache to fix 'User' / 'Anonymous' fallback issues
  useEffect(() => {
    if (conversations.length === 0 || !db) return;
    const fetchNames = async () => {
      const missingUserIds = conversations
        .map(c => c.otherUser.id)
        .filter(id => id && !userProfilesCache[id]);
      
      if (missingUserIds.length === 0) return;

      const newCache = { ...userProfilesCache };
      let updated = false;

      for (const uid of missingUserIds) {
        try {
          const userDocRef = doc(db, "users", uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
             const data = userDocSnap.data();
             newCache[uid] = {
               name: data.fullName || "User",
               avatarUrl: data.avatarUrl || null
             };
             updated = true;
          }
        } catch (e) {
          console.warn("Failed to fetch user profile for cache:", uid, e);
        }
      }

      if (updated) {
        setUserProfilesCache(newCache);
      }
    };

    fetchNames();
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
        const otherUserName = data.participantNames?.[otherUserId] || 'Anonymous';
        
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
          otherUser: { id: otherUserId, name: otherUserName },
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
      
      let otherUserName = "User";
      try {
        const userDocRef = doc(db, "users", activeChatContext.userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          otherUserName = userDocSnap.data().fullName || "User";
        }
      } catch (e) {
        console.warn("Failed to get other user name", e);
      }

      await setDoc(chatRef, {
        id: chatId,
        participants: [user.id, activeChatContext.userId],
        participantNames: {
          [user.id]: user.fullName || "Me",
          [activeChatContext.userId]: otherUserName
        },
        relatedSpotTitle: activeChatContext.context || "Street Spot",
        lastMessage: "Conversation started",
        lastMessageTimestamp: serverTimestamp(),
        lastSenderId: user.id
      }, { merge: true });

      setActiveConversationId(chatId);
    };
    
    initChat();
  }, [user?.id, activeChatContext]);

  // 3. Listen to messages for the active conversation
  useEffect(() => {
    if (!activeConversationId || !user || !db) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, "chats", activeConversationId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          senderId: data.senderId,
          text: data.text || '',
          timestamp: data.timestamp?.toDate() || new Date(),
          isMe: data.senderId === user.id
        };
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeConversationId, user?.id]);

  // Update last read timestamp in localStorage when active chat receives messages
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(`lastReadChat_${activeConversationId}`, Date.now().toString());
    }
    setIsMenuOpen(false);
  }, [activeConversationId, messages.length]);

  // 4. Auto-scroll to bottom of messages & trigger Smart Replies
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.isMe) {
        generateSmartReplies(lastMsg.text, activeConversation?.relatedSpotTitle || "Parking Spot").then(replies => {
          setSmartReplies(replies);
        }).catch(err => {
          console.warn("Gemini smart replies failed", err);
          setSmartReplies([]);
        });
      } else {
        setSmartReplies([]);
      }
    }
  }, [messages, activeConversationId]);

  // 5. Send message
  const handleSend = async (text: string) => {
    if (!text.trim() || !activeConversationId || !user || !db) return;
    setModerationError('');

    const blocked = moderateMessage(text.trim());
    if (blocked) {
        setModerationError(blocked);
        setTimeout(() => setModerationError(''), 4000);
        return;
    }

    localStorage.setItem(`lastReadChat_${activeConversationId}`, Date.now().toString());
    const chatRef = doc(db, "chats", activeConversationId);
    const messagesRef = collection(db, "chats", activeConversationId, "messages");
    
    const messageData = {
        senderId: user.id,
        text: text.trim(),
        timestamp: serverTimestamp()
    };
    
    setInputText('');
    setSmartReplies([]);

    try {
        await addDoc(messagesRef, messageData);
        await setDoc(chatRef, {
            lastMessage: text.trim(),
            lastMessageTimestamp: serverTimestamp(),
            lastSenderId: user.id
        }, { merge: true });
    } catch (e) {
        console.error("Error sending message", e);
    }
  };

  if (activeConversationId && activeConversation) {
    return (
      <div className="h-full flex flex-col bg-[var(--color-bg)] pt-4 pb-20">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveConversationId(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
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
              <h3 className="font-bold text-[var(--color-text)]">{userProfilesCache[activeConversation.otherUser.id]?.name || activeConversation.otherUser.name}</h3>
              {activeConversation.relatedSpotTitle && (
                <p className="text-xs text-queen-400">{activeConversation.relatedSpotTitle}</p>
              )}
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-2 hover:bg-white/5 rounded-full transition-colors">
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
                    Delete Chat
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); handleBlockUser(); }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--color-text)] hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                  >
                    Block User
                  </button>
                  <button
                    onClick={() => { setIsMenuOpen(false); setShowReportModal(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--color-text)] hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                  >
                    Report User
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
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
          <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center pb-10">
            <div className="bg-[var(--color-surface)] rounded-3xl p-6 mx-4 w-full max-w-sm border border-[var(--color-border)] shadow-2xl">
              <p className="text-base font-bold text-[var(--color-text)] text-center mb-1">Delete this conversation?</p>
              <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6">This can't be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-sm">
                  Cancel
                </button>
                <button onClick={doDeleteChat} className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showReportModal && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] rounded-3xl p-5 w-full max-w-sm border border-[var(--color-border)] shadow-2xl">
              <h3 className="font-bold text-[var(--color-text)] mb-3">Report User</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">Why are you reporting this user?</p>
              <div className="space-y-2">
                {['Harassment or abuse', 'Inappropriate messages', 'Spam', 'Scam or fraud', 'Other'].map(reason => (
                  <button key={reason} onClick={() => handleReportUser(reason)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all text-[var(--color-text)] text-left px-4">
                    {reason}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowReportModal(false)}
                className="w-full mt-3 text-[var(--color-text-secondary)] text-sm text-center py-2">
                Cancel
              </button>
            </div>
          </div>
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
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-[var(--color-text)] text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
            />
            <button 
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim()}
              className="p-2 bg-queen-600 rounded-full text-white disabled:opacity-50 disabled:bg-[var(--color-surface)]"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] pt-4 pb-20 max-w-md mx-auto">
       {/* Header */}
       <div className="flex items-center justify-between px-4 mb-6">
         <div className="flex items-center gap-3">
           {onBack && (
             <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
               <ArrowLeft size={20} />
             </button>
           )}
           <div>
             <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-wide">Inbox</h2>
             <p className="text-xs text-[var(--color-text-secondary)]">Stay updated with your parking community</p>
           </div>
         </div>
       </div>

       {/* Conversation List */}
       <div className="flex-1 overflow-y-auto px-4 space-y-4 no-scrollbar">
          {conversations.length === 0 ? (
            <div className="text-center p-10 text-gray-500">
              <p>Claim a spot or offer yours to start a conversation.</p>
            </div>
          ) : (
            conversations.map(conv => {
              const lastReadStr = localStorage.getItem(`lastReadChat_${conv.id}`);
              const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;
              const hasUnread = conv.lastMessageTimestamp.getTime() > lastReadTime && conv.lastSenderId !== user.id;

              return (
                <button 
                  key={conv.id} 
                  onClick={() => setActiveConversationId(conv.id)}
                  className="w-full bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl p-4 flex items-start gap-4 text-left transition-all hover:bg-[#0b2240]/60 relative"
                >
                  {/* Avatar with blue unread dot */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-gray-500 overflow-hidden">
                       {userProfilesCache[conv.otherUser.id]?.avatarUrl ? (
                         <img src={userProfilesCache[conv.otherUser.id].avatarUrl!} alt="Avatar" className="w-full h-full object-cover" />
                       ) : (
                         <i className="fa-solid fa-user text-2xl"></i>
                       )}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#1e75ff] border-2 border-dark-900 rounded-full animate-pulse motion-reduce:animate-none" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className="font-bold text-[var(--color-text)] text-base truncate pr-2">
                        {userProfilesCache[conv.otherUser.id]?.name || conv.otherUser.name}
                      </h3>
                      <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                        {conv.lastMessageTimestamp instanceof Date 
                          ? conv.lastMessageTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : 'Just now'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-0.5">
                      <p className={`text-sm truncate pr-4 ${hasUnread ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>
                        {conv.lastMessage}
                      </p>
                      {hasUnread && (
                        <span className="flex items-center justify-center w-5 h-5 bg-[#1e75ff] text-white text-[10px] font-bold rounded-full shrink-0">
                          1
                        </span>
                      )}
                    </div>

                    {conv.relatedSpotTitle && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] text-[#38bdf8] bg-[#1e75ff]/10 border border-[#1e75ff]/20 px-2.5 py-0.5 rounded-full">
                         <MapPin size={10} className="text-[#38bdf8]" />
                         <span>{conv.relatedSpotTitle}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}

          {/* All caught up footer */}
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-[var(--color-glass)] border border-[var(--color-border)] flex items-center justify-center text-[#1e75ff] shadow-lg relative">
                <MessageSquare size={22} fill="#1e75ff" className="text-[#1e75ff]" />
                <Sparkles size={14} className="absolute -top-1 -right-1 text-blue-400 animate-pulse motion-reduce:animate-none" />
                <Sparkles size={10} className="absolute -bottom-1 -left-1 text-blue-300 animate-pulse motion-reduce:animate-none" />
              </div>
            </div>
            <h3 className="text-[var(--color-text)] font-bold text-sm">All caught up!</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">You'll see new messages here.</p>
          </div>
       </div>
    </div>
  );
};
