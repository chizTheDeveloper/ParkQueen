import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronLeft, MoreVertical, Sparkles, ArrowLeft } from 'lucide-react';
import { generateSmartReplies } from '../services/geminiService';

const MOCK_CONVERSATIONS = [
  {
    id: 'c1',
    otherUser: { id: 'u2', name: 'Alex', avatar: 'https://i.pravatar.cc/150?u=2' },
    lastMessage: 'Is the spot still there?',
    unreadCount: 1,
    relatedSpotTitle: 'Free Spot - 82nd St',
    messages: [
      { id: 'm1', senderId: 'u2', text: 'Hey, I see you pinged a spot on 82nd.', timestamp: new Date(Date.now() - 1000 * 60 * 60), isMe: false },
      { id: 'm2', senderId: 'me', text: 'Yes! Just leaving now.', timestamp: new Date(Date.now() - 1000 * 60 * 55), isMe: true },
      { id: 'm3', senderId: 'u2', text: 'Is the spot still there?', timestamp: new Date(Date.now() - 1000 * 60 * 2), isMe: false },
    ]
  },
  {
    id: 'c2',
    otherUser: { id: 'h1', name: 'James', avatar: 'https://i.pravatar.cc/150?u=h1' },
    lastMessage: 'Thanks for booking!',
    unreadCount: 0,
    relatedSpotTitle: 'Private Driveway - UWS',
    messages: [
        { id: 'm4', senderId: 'h1', text: 'Thanks for booking! The gate code is 4492.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), isMe: false },
    ]
  }
];

export const MessagesView = ({ onBack }) => {
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const messagesEndRef = useRef(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    if (activeConversation) {
      // Scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Generate AI replies for the last received message
      const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
      if (!lastMsg.isMe) {
        generateSmartReplies(lastMsg.text, activeConversation.relatedSpotTitle || "Parking Spot").then(replies => {
          setSmartReplies(replies);
        });
      } else {
        setSmartReplies([]);
      }
    }
  }, [activeConversation, activeConversation?.messages]);

  const handleSend = (text) => {
    if (!text.trim() || !activeConversationId) return;

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return {
          ...c,
          messages: [...c.messages, {
            id: Date.now().toString(),
            senderId: 'me',
            text: text,
            timestamp: new Date(),
            isMe: true
          }],
          lastMessage: text
        };
      }
      return c;
    }));
    setInputText('');
    setSmartReplies([]);
  };

  if (activeConversationId && activeConversation) {
    return (
      <div className="h-full flex flex-col bg-dark-900 pt-4 pb-20">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveConversationId(null)} className="text-gray-400 hover:text-white">
              <ChevronLeft size={24} />
            </button>
            <img src={activeConversation.otherUser.avatar} alt="User" className="w-10 h-10 rounded-full border border-dark-600" />
            <div>
              <h3 className="font-bold text-white">{activeConversation.otherUser.name}</h3>
              {activeConversation.relatedSpotTitle && (
                <p className="text-xs text-queen-400">{activeConversation.relatedSpotTitle}</p>
              )}
            </div>
          </div>
          <button className="text-gray-500">
            <MoreVertical size={20} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {activeConversation.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.isMe 
                  ? 'bg-queen-600 text-white rounded-br-none' 
                  : 'bg-dark-800 text-gray-200 border border-dark-700 rounded-bl-none'
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
                className="whitespace-nowrap bg-dark-800 border border-queen-500/30 text-queen-100 text-xs px-3 py-1.5 rounded-full hover:bg-queen-900/40 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-dark-700 bg-dark-900">
          <div className="flex items-center gap-2 bg-dark-800 rounded-full px-4 py-2 border border-dark-700 focus-within:border-queen-500 transition-colors">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
            />
            <button 
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim()}
              className="p-2 bg-queen-600 rounded-full text-white disabled:opacity-50 disabled:bg-dark-600"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-900 pt-4 pb-20">
       <div className="px-4 mb-4">
         <div className="flex items-center gap-4 mb-4">
           {onBack && (
             <button onClick={onBack} className="p-2 -ml-2 text-white hover:bg-dark-800 rounded-full transition-colors">
               <ArrowLeft size={24} />
             </button>
           )}
           <h2 className="text-2xl font-bold text-white">Inbox</h2>
         </div>
         <div className="flex gap-4 border-b border-dark-700 pb-1">
           <button className="text-white font-medium border-b-2 border-queen-500 pb-2 px-2">Messages</button>
           <button className="text-gray-500 font-medium pb-2 px-2">Notifications</button>
         </div>
       </div>

       <div className="flex-1 overflow-y-auto px-4">
          {conversations.map(conv => (
            <button 
              key={conv.id} 
              onClick={() => setActiveConversationId(conv.id)}
              className="w-full flex items-center gap-4 py-4 border-b border-dark-800 hover:bg-dark-800/50 transition-colors rounded-xl px-2"
            >
              <div className="relative">
                <img src={conv.otherUser.avatar} alt={conv.otherUser.name} className="w-12 h-12 rounded-full" />
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-queen-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-dark-900">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between mb-1">
                  <h3 className="font-bold text-white">{conv.otherUser.name}</h3>
                  <span className="text-xs text-gray-500">2m ago</span>
                </div>
                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {conv.lastMessage}
                </p>
                {conv.relatedSpotTitle && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-queen-400 bg-queen-900/20 px-1.5 py-0.5 rounded">
                     Spot: {conv.relatedSpotTitle}
                  </div>
                )}
              </div>
            </button>
          ))}
       </div>
    </div>
  );
};
