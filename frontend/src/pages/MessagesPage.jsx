import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Send, MessageSquare, Search, ArrowLeft, Phone, Mail } from 'lucide-react';
import { messageAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo, resolveImageUrl } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messageAPI.getConversations()
      .then(({ data }) => {
        setConversations(data.conversations);
        const userId = searchParams.get('userId');
        if (userId) {
          const conv = data.conversations.find(c => c.user?._id === userId);
          if (conv) {
            openConversation(conv);
          } else {
            // Nouvelle conversation avec cet utilisateur
            openNewConversation(userId);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (conv) => {
    setActiveConv(conv);
    setMobileView('chat');
    try {
      const { data } = await messageAPI.getConversation(conv.user._id);
      setMessages(data.messages);
      // Marquer comme lus dans la liste
      setConversations(p => p.map(c =>
        c.user?._id === conv.user?._id ? { ...c, unreadCount: 0 } : c
      ));
    } catch { toast.error('Erreur de chargement'); }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openNewConversation = async (userId) => {
    // Charger les infos de l'utilisateur depuis les messages vides
    setActiveConv({ user: { _id: userId, name: 'Propriétaire' }, lastMessage: null, unreadCount: 0 });
    setMessages([]);
    setMobileView('chat');
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeConv || sending) return;
    setSending(true);
    const content = newMsg.trim();
    setNewMsg('');

    // Optimistic update
    const tempMsg = {
      _id: 'temp-' + Date.now(),
      sender: { _id: user._id, name: user.name, profileImage: user.profileImage },
      content,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages(p => [...p, tempMsg]);

    try {
      const { data } = await messageAPI.send({ receiverId: activeConv.user._id, content });
      setMessages(p => p.map(m => m._id === tempMsg._id ? { ...data.message, sender: tempMsg.sender } : m));
      // Mettre à jour la liste des conversations
      setConversations(p => {
        const exists = p.find(c => c.user?._id === activeConv.user._id);
        if (exists) {
          return p.map(c => c.user?._id === activeConv.user._id ? { ...c, lastMessage: data.message } : c);
        }
        return [{ user: activeConv.user, lastMessage: data.message, unreadCount: 0 }, ...p];
      });
    } catch {
      setMessages(p => p.filter(m => m._id !== tempMsg._id));
      toast.error('Erreur d\'envoi. Réessayez.');
      setNewMsg(content);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c =>
    !search || c.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl text-gray-800 mb-6 flex items-center gap-2">
        <MessageSquare size={24} className="text-primary-500" />
        Messages
        {totalUnread > 0 && (
          <span className="bg-primary-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {totalUnread}
          </span>
        )}
      </h1>

      <div className="card overflow-hidden flex" style={{ height: '620px' }}>
        {/* ─── LISTE CONVERSATIONS ──────────────────────── */}
        <div className={`
          ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
          w-full md:w-72 flex-shrink-0 border-r border-gray-100 flex-col
        `}>
          {/* Recherche */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-primary-400 focus:outline-none"
                placeholder="Chercher une conversation..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 font-medium">Aucune conversation</p>
                <p className="text-xs text-gray-400 mt-1">Contactez un propriétaire depuis une annonce</p>
                <Link to="/rechercher" className="inline-block mt-3 text-xs text-primary-500 hover:underline">
                  Explorer les logements →
                </Link>
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const isActive = activeConv?.user?._id === conv.user?._id;
                return (
                  <button key={i} onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${isActive ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}>
                    {/* Avatar */}
                    {conv.user?.profileImage?.url ? (
                      <img src={resolveImageUrl(conv.user.profileImage.url)} alt=""
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-600 font-bold">{conv.user?.name?.[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-gray-800 truncate">{conv.user?.name}</p>
                        {conv.lastMessage && (
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                            {timeAgo(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.lastMessage?.content || 'Nouvelle conversation'}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── ZONE DE CHAT ─────────────────────────────── */}
        <div className={`
          ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
          flex-1 flex-col min-w-0
        `}>
          {activeConv ? (
            <>
              {/* Header conversation */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-white">
                <button onClick={() => setMobileView('list')}
                  className="md:hidden text-gray-500 hover:text-primary-500 mr-1">
                  <ArrowLeft size={20} />
                </button>
                {activeConv.user?.profileImage?.url ? (
                  <img src={resolveImageUrl(activeConv.user.profileImage.url)} alt=""
                    className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 font-bold text-sm">{activeConv.user?.name?.[0]}</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{activeConv.user?.name}</p>
                  <p className="text-xs text-gray-400">MaliRent · Messages sécurisés</p>
                </div>
                {/* Actions rapides */}
                <div className="flex gap-1">
                  <a href={`tel:${activeConv.user?.phone}`}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
                    title="Appeler">
                    <Phone size={16} />
                  </a>
                  <a href={`mailto:${activeConv.user?.email}`}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Email">
                    <Mail size={16} />
                  </a>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                {messages.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Commencez la conversation</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender?._id === user._id || msg.sender === user._id;
                  const showTime = i === 0 || new Date(msg.createdAt) - new Date(messages[i-1]?.createdAt) > 300000;
                  return (
                    <div key={msg._id}>
                      {showTime && (
                        <div className="text-center text-xs text-gray-400 my-2">
                          {timeAgo(msg.createdAt)}
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                            <span className="text-primary-600 font-bold text-xs">{activeConv.user?.name?.[0]}</span>
                          </div>
                        )}
                        <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-primary-500 text-white rounded-br-sm shadow-sm'
                            : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                        } ${msg._id?.startsWith('temp-') ? 'opacity-70' : ''}`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Zone d'envoi */}
              <form onSubmit={sendMessage}
                className="p-3 border-t border-gray-100 bg-white flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  className="flex-1 px-4 py-2.5 text-sm bg-gray-50 rounded-2xl border border-gray-200 focus:border-primary-400 focus:outline-none resize-none"
                  placeholder="Écrire un message..."
                  rows={1}
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                  style={{ maxHeight: '120px' }}
                />
                <button type="submit" disabled={!newMsg.trim() || sending}
                  className="w-10 h-10 bg-primary-500 text-white rounded-2xl flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-40 flex-shrink-0">
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={16} />
                  }
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-primary-500" />
              </div>
              <h3 className="font-bold text-gray-700 text-lg mb-2">Vos messages</h3>
              <p className="text-gray-400 text-sm max-w-xs mb-5">
                Sélectionnez une conversation ou contactez un propriétaire depuis une annonce.
              </p>
              <Link to="/rechercher" className="btn-primary text-sm">
                Trouver un logement
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
