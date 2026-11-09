
import { supabase } from './supabase-client.js';

/**
 * SubMed — User Backend
 *
 * Profile management, account settings and authentication.
 * Uses Supabase Auth and the existing profiles table.
 */

const PROFILE_FIELDS = [
    'name',
    'center',
    'preferred_tool',
    'goal',
    'subjects',
    'target_score',
    'settings'
];

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 3 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

/**
 * Internal helpers
 */
async function requireUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {
        throw new Error('Trebuie să fii autentificat.');
    }

    return data.user;
}

function handleError(error, fallback = 'A apărut o eroare.') {
    console.error('[SubMed User Backend]', error);
    throw new Error(error?.message || fallback);
}

function filterProfileFields(payload = {}) {
    return Object.fromEntries(
        Object.entries(payload).filter(([key]) =>
            PROFILE_FIELDS.includes(key)
        )
    );
}

/**
 * Profiles API
 *
 * Compatible with:
 * Profiles.get()
 * Profiles.getPreferences()
 * Profiles.savePreferences()
 */
export const Profiles = {

    /**
     * Get the current user's profile.
     */
    async get() {
        try {
            const user = await requireUser();

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                handleError(error, 'Nu s-a putut încărca profilul.');
            }

            return data;
        } catch (error) {
            handleError(error, 'Nu s-a putut încărca profilul.');
        }
    },

    /**
     * Get profile preferences.
     */
    async getPreferences() {
        try {
            const profile = await this.get();

            if (!profile) {
                return null;
            }

            return {
                name: profile.name ?? '',
                center: profile.center ?? '',
                subjects: profile.subjects ?? [],
                preferred_tool: profile.preferred_tool ?? '',
                goal: profile.goal ?? '',
                target_score: profile.target_score ?? null,
                settings: profile.settings ?? {}
            };
        } catch (error) {
            handleError(error, 'Nu s-au putut încărca preferințele.');
        }
    },

    /**
     * Save allowed profile preferences.
     */
    async savePreferences(payload = {}) {
        try {
            const user = await requireUser();
            const updates = filterProfileFields(payload);

            if (Object.keys(updates).length === 0) {
                throw new Error('Nu există modificări valide.');
            }

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                handleError(error, 'Nu s-au putut salva preferințele.');
            }

            return data;
        } catch (error) {
            handleError(error, 'Nu s-au putut salva preferințele.');
        }
    },

    /**
     * Update profile display name.
     */
    async updateName(name) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new Error('Introdu un nume valid.');
        }

        return this.savePreferences({
            name: name.trim()
        });
    },

    /**
     * Update study center.
     */
    async updateCenter(center) {
        return this.savePreferences({
            center
        });
    },

    /**
     * Update study preferences.
     */
    async updateStudyPreferences(preferences = {}) {
        return this.savePreferences(preferences);
    }
};


/**
 * User Account API
 *
 * Authentication, email, password, sessions and avatar.
 */
export const UserAccount = {

    /**
     * Get authenticated user.
     */
    async getCurrentUser() {
        try {
            return await requireUser();
        } catch (error) {
            handleError(error, 'Nu s-au putut încărca datele contului.');
        }
    },

    /**
     * Request an email address change.
     *
     * Supabase sends a confirmation email according
     * to the project's Auth configuration.
     */
    async requestEmailChange(newEmail) {
        try {
            if (
                typeof newEmail !== 'string' ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
            ) {
                throw new Error('Adresa de email nu este validă.');
            }

            await requireUser();

            const { data, error } = await supabase.auth.updateUser({
                email: newEmail.trim()
            });

            if (error) {
                handleError(error, 'Nu s-a putut solicita schimbarea emailului.');
            }

            return data;
        } catch (error) {
            handleError(error, 'Nu s-a putut schimba adresa de email.');
        }
    },

    /**
     * Update account password.
     */
    async updatePassword(newPassword) {
        try {
            if (
                typeof newPassword !== 'string' ||
                newPassword.length < 8
            ) {
                throw new Error(
                    'Parola trebuie să conțină cel puțin 8 caractere.'
                );
            }

            await requireUser();

            const { data, error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                handleError(error, 'Nu s-a putut actualiza parola.');
            }

            return data;
        } catch (error) {
            handleError(error, 'Nu s-a putut actualiza parola.');
        }
    },

    /**
     * Sign out other sessions.
     *
     * Requires an authenticated session.
     */
    async signOutOtherSessions() {
        try {
            await requireUser();

            const { data, error } = await supabase.auth.signOut({
                scope: 'others'
            });

            if (error) {
                handleError(error, 'Nu s-au putut închide celelalte sesiuni.');
            }

            return data;
        } catch (error) {
            handleError(error, 'Nu s-au putut închide celelalte sesiuni.');
        }
    },

    /**
     * Sign out current session.
     */
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut({
                scope: 'local'
            });

            if (error) {
                handleError(error, 'Deconectarea a eșuat.');
            }

            return true;
        } catch (error) {
            handleError(error, 'Deconectarea a eșuat.');
        }
    },

    /**
     * Upload user avatar.
     *
     * Requires:
     * - Supabase Storage bucket: avatars
     * - Storage policies restricting access to the
     *   authenticated user's own folder.
     */
    async uploadAvatar(file) {
        try {
            const user = await requireUser();

            if (!(file instanceof File)) {
                throw new Error('Fișierul selectat nu este valid.');
            }

            if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
                throw new Error(
                    'Format acceptat: JPG, PNG sau WebP.'
                );
            }

            if (file.size > MAX_AVATAR_SIZE) {
                throw new Error(
                    'Imaginea nu poate depăși 3 MB.'
                );
            }

            const extension = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp'
            }[file.type];

            const filePath = `${user.id}/avatar.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from(AVATAR_BUCKET)
                .upload(filePath, file, {
                    upsert: true,
                    contentType: file.type,
                    cacheControl: '3600'
                });

            if (uploadError) {
                handleError(uploadError, 'Încărcarea imaginii a eșuat.');
            }

            const { data: publicData } = supabase.storage
                .from(AVATAR_BUCKET)
                .getPublicUrl(filePath);

            const avatarUrl = publicData?.publicUrl;

            if (!avatarUrl) {
                throw new Error('Nu s-a putut obține URL-ul imaginii.');
            }

            const { data, error: profileError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: avatarUrl
                })
                .eq('id', user.id)
                .select()
                .single();

            if (profileError) {
                handleError(
                    profileError,
                    'Imaginea a fost încărcată, dar profilul nu a putut fi actualizat.'
                );
            }

            return {
                avatar_url: avatarUrl,
                profile: data
            };
        } catch (error) {
            handleError(error, 'Nu s-a putut actualiza fotografia de profil.');
        }
    },

    /**
     * Get current user's subscription profile.
     *
     * This reads the existing profile fields.
     * It does not modify subscription status.
     */
    
async getSubscriptionInfo() {
    const user = await requireUser();

    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            id,
            tier,
            status,
            started_at,
            expires_at,
            cancel_at_period_end,
            canceled_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

};


/**
 * Default export for projects using a single import.
 */
export default {
    Profiles,
    UserAccount
};
