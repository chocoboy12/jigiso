import { createContext, useContext, useState, useCallback } from 'react';
import FeedbackModal from '../components/feedback/FeedbackModal';

/**
 * Pilote la fenêtre de retour d'expérience.
 *
 *   const { openFeedback } = useFeedback();
 *
 * La fenêtre est montée une seule fois à la racine : n'importe quel écran
 * peut l'ouvrir sans la dupliquer.
 */
const FeedbackContext = createContext(null);

export const FeedbackProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const openFeedback = useCallback(() => setOpen(true), []);
  const closeFeedback = useCallback(() => setOpen(false), []);

  return (
    <FeedbackContext.Provider value={{ openFeedback, closeFeedback }}>
      {children}
      <FeedbackModal open={open} onClose={closeFeedback} />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans FeedbackProvider');
  return ctx;
};
