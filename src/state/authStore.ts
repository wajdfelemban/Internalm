import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { closeDatabase, openDatabaseForUser } from "../db/dexie";

const LOCAL_USER_ID_KEY = "recall-local-user-id";
const LOCAL_ONLY_MODE_KEY = "recall-local-only-mode";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True when using the app without a Supabase account — data stays on this device only. */
  isLocalOnly: boolean;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  init: () => Promise<void>;
  continueLocalOnly: () => void;
  signOut: () => Promise<void>;
}

function getOrCreateLocalUserId(): string {
  let id = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return id;
}

function enterLocalOnly(set: (partial: Partial<AuthState>) => void): void {
  localStorage.setItem(LOCAL_ONLY_MODE_KEY, "1");
  const id = getOrCreateLocalUserId();
  const localUser = {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  } as unknown as User;
  set({ session: null, user: localUser, isLocalOnly: true, initializing: false });
  openDatabaseForUser(id);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLocalOnly: false,
  initializing: true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, isLocalOnly: false });
    if (session?.user) {
      localStorage.removeItem(LOCAL_ONLY_MODE_KEY);
      openDatabaseForUser(session.user.id);
    } else {
      closeDatabase();
    }
  },

  init: async () => {
    const { data } = await supabase.auth.getSession();

    // A real Supabase session always wins. Otherwise, if the last thing this
    // browser did was "continue without an account", restore that instead of
    // dumping the user back on the login screen every time the tab reloads.
    if (data.session) {
      get().setSession(data.session);
      set({ initializing: false });
    } else if (localStorage.getItem(LOCAL_ONLY_MODE_KEY) === "1") {
      enterLocalOnly(set);
    } else {
      set({ initializing: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      // A real sign-in always takes over from local-only mode.
      if (session || !get().isLocalOnly) get().setSession(session);
    });
  },

  continueLocalOnly: () => enterLocalOnly(set),

  signOut: async () => {
    if (!get().isLocalOnly) await supabase.auth.signOut();
    localStorage.removeItem(LOCAL_ONLY_MODE_KEY);
    set({ session: null, user: null, isLocalOnly: false });
    closeDatabase();
  },
}));
