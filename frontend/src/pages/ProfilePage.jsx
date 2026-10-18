import { useState } from 'react';
import { Camera, Save, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { ROLE_LABELS } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(user?.profileImage?.url || '');

  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', whatsapp: user?.whatsapp || '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('phone', form.phone);
      formData.append('whatsapp', form.whatsapp);
      if (profileImage) formData.append('profileImage', profileImage);

      const { data } = await userAPI.updateProfile(formData);
      updateUser(data.user);
      toast.success('Profil mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return toast.error('Les mots de passe ne correspondent pas');
    if (pwdForm.newPassword.length < 6) return toast.error('Minimum 6 caractères');
    setPwdLoading(true);
    try {
      await userAPI.changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      toast.success('Mot de passe modifié');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl text-gray-800 mb-8">Mon profil</h1>

      {/* Photo de profil */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {imagePreview ? (
              <img src={imagePreview} alt={user?.name} className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-bold text-3xl">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-600 transition-colors shadow-lg">
              <Camera size={14} className="text-white" />
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-lg">{user?.name}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full font-medium">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="card p-6 mb-6">
        <h2 className="font-display font-bold text-lg text-gray-800 mb-5 pb-3 border-b">Informations personnelles</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="label">Nom complet</label>
            <input className="input-field" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field bg-gray-50" value={user?.email} disabled />
            <p className="text-xs text-gray-400 mt-1">L'email ne peut pas être modifié</p>
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input-field" placeholder="+223 70 00 00 00" value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          {/* Numéro WhatsApp : souvent une autre puce que celle des appels.
              C'est lui, et lui seul, qui apparaît en bouton WhatsApp sur les
              annonces. Laissé vide, aucun bouton n'est proposé. */}
          <div>
            <label className="label">Numéro WhatsApp</label>
            <input className="input-field" placeholder="+223 76 00 00 00" value={form.whatsapp}
              onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">
              {form.whatsapp.trim()
                ? 'Les locataires verront un bouton WhatsApp sur vos annonces.'
                : "Sans ce numéro, aucun bouton WhatsApp n'apparaît sur vos annonces."}
            </p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={16} />
            }
            Sauvegarder
          </button>
        </form>
      </div>

      {/* Changer le mot de passe */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg text-gray-800 mb-5 pb-3 border-b flex items-center gap-2">
          <Lock size={18} className="text-primary-500" /> Changer le mot de passe
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Mot de passe actuel</label>
            <input type="password" className="input-field" value={pwdForm.currentPassword}
              onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input type="password" className="input-field" value={pwdForm.newPassword}
              onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Confirmer le nouveau mot de passe</label>
            <input type="password" className="input-field" value={pwdForm.confirmPassword}
              onChange={e => setPwdForm(p => ({ ...p, confirmPassword: e.target.value }))} required />
          </div>
          <button type="submit" disabled={pwdLoading} className="btn-primary flex items-center gap-2">
            {pwdLoading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Lock size={16} />
            }
            Modifier le mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}
