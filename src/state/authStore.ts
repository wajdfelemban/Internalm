import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { closeDatabase, openDatabaseForUser } from "../db/dexie";

interface AuthState {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initializing: true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
    if (session?.user) {
      openDatabaseForUser(session.user.id);
    } else {
      closeDatabase();
    }
  },

  init: async () => {
    const { data } = await supabase.auth.getSession();
    get().setSession(data.session);
    set({ initializing: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      get().setSession(session);
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    get().setSession(null);
  },
}));
