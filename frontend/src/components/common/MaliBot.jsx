import { useState, useRef, useEffect } from 'react';
import { useT } from '../../context/LanguageContext';
import { MessageSquare, X, Send, Bot, Loader } from 'lucide-react';
import { aiAPI } from '../../services/api';

/* Constantes de module : la traduction est appliquée à l'affichage, pas ici —
   `t` n'existe qu'à l'intérieur d'un composant. */
const SUGGESTIONS = [
  'Quel est le prix moyen à ACI 2000 ?',
  'Quel quartier pour un petit budget ?',
  'Comment contacter un propriétaire ?',
  'Différence villa et maison ?',
];

export default function MaliBot({ propertyContext }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t("Bonjour ! Je suis l'assistant JIGISO. Comment puis-je vous aider à trouver votre logement au Mali ?"),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  /* Permet d'interrompre la réponse en cours quand on ferme la fenêtre. */
  const abortRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // On insère tout de suite une bulle vide : le texte viendra s'y écrire
    // morceau par morceau, au lieu d'apparaître d'un bloc après l'attente.
    const indexReponse = newMessages.length;
    setMessages(p => [...p, { role: 'assistant', content: '' }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await aiAPI.chatStream(
        {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          propertyContext,
          signal: ctrl.signal,
        },
        (fragment) => {
          setMessages(p => {
            const copie = [...p];
            copie[indexReponse] = {
              role: 'assistant',
              content: (copie[indexReponse]?.content || '') + fragment,
            };
            return copie;
          });
        },
      );
    } catch (err) {
      if (err.name === 'AbortError') return;   // interrompu volontairement
      setMessages(p => {
        const copie = [...p];
        // Si rien n'est arrivé, on remplace la bulle vide par l'explication.
        copie[indexReponse] = {
          role: 'assistant',
          content: copie[indexReponse]?.content
            || "Désolé, je suis temporairement indisponible. Réessayez dans un moment.",
        };
        return copie;
      });
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-ink text-cream pl-4 pr-5 py-3 rounded-pill shadow-dark hover:bg-gold hover:text-ink transition-all hover:scale-105 active:scale-95"
          data-malibot
        >
          <Bot size={20} className="text-primary-400" />
          <span className="font-semibold text-[13px]">{t('Assistant JIGISO')}</span>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-leaf rounded-full animate-pulse" />
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 flex flex-col bg-cream-card rounded-panel shadow-dark border border-cream-line overflow-hidden"
          style={{ maxHeight: '520px' }}>

          {/* Header */}
          <div className="bg-ink px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <Bot size={16} className="text-primary-400" />
              </div>
              <div>
                <p className="text-cream font-display font-bold text-sm">{t('Assistant JIGISO')}</p>
                <p className="text-gray-400 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-accent-400 rounded-full inline-block" />
                  Assistant IA · Mali
                </p>
              </div>
            </div>
            <button onClick={() => { abortRef.current?.abort(); setOpen(false); }}
              className="text-gray-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0, maxHeight: '340px' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-primary-600" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-ink text-cream rounded-br-sm'
                    : 'bg-cream text-ink rounded-bl-sm border border-cream-line'
                }`}>
                  {m.content}
                  {loading && i === messages.length - 1 && m.role === 'assistant' && (
                    <span className="inline-block w-[2px] h-[1em] align-[-.15em] ml-[2px]
                                     bg-current animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2 flex-shrink-0">
                  <Bot size={12} className="text-primary-600" />
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions (seulement au début) */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-[11px] border border-ink/15 text-clay-500 px-2.5 py-1.5 rounded-pill hover:border-ink hover:text-ink transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              className="flex-1 text-sm px-3.5 py-2.5 rounded-pill border border-cream-line bg-cream focus:border-gold focus:outline-none"
              placeholder={t('Posez votre question...')}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-ink text-cream rounded-full flex items-center justify-center hover:bg-gold hover:text-ink transition-colors disabled:opacity-40 shrink-0"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
