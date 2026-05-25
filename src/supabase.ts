import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize client if credentials are provided
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Determine if we are running in Supabase mode or fallback LocalStorage mode
export const isSupabaseConfigured = !!supabase;

// Define Types
export interface NameSuggestion {
  id: string;
  name: string;
  likes: number;
  created_at: string;
}

export interface VoteStats {
  boy: number;
  girl: number;
  total: number;
}

// Local Storage Fallback Keys
const LOCAL_STORAGE_VOTES_KEY = 'oh_baby_local_votes';
const LOCAL_STORAGE_NAMES_KEY = 'oh_baby_local_names';

// ==========================================
// fallback local helpers
// ==========================================

const getLocalVotes = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_VOTES_KEY) || '[]');
  } catch {
    return [];
  }
};

const getLocalNames = (): NameSuggestion[] => {
  try {
    const names = localStorage.getItem(LOCAL_STORAGE_NAMES_KEY);
    if (!names) {
      // Return some cute mock names initially to make the site look populated and beautiful!
      const initialMockNames: NameSuggestion[] = [
        { id: '1', name: 'Aurelia', likes: 18, created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
        { id: '2', name: 'Oliver', likes: 15, created_at: new Date(Date.now() - 3600000 * 12).toISOString() },
        { id: '3', name: 'Hazel', likes: 24, created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
        { id: '4', name: 'Milo', likes: 11, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
        { id: '5', name: 'Freya', likes: 29, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
        { id: '6', name: 'Leo', likes: 9, created_at: new Date().toISOString() },
      ];
      localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(initialMockNames));
      return initialMockNames;
    }
    return JSON.parse(names);
  } catch {
    return [];
  }
};

// ==========================================
// GENDER VOTING SERVICES
// ==========================================

export const fetchVoteStats = async (): Promise<VoteStats> => {
  if (supabase) {
    try {
      // Fetch boys count
      const { count: boyCount, error: boyError } = await supabase
        .from('gender_votes')
        .select('*', { count: 'exact', head: true })
        .eq('gender', 'boy');

      // Fetch girls count
      const { count: girlCount, error: girlError } = await supabase
        .from('gender_votes')
        .select('*', { count: 'exact', head: true })
        .eq('gender', 'girl');

      if (boyError || girlError) throw new Error('Failed to fetch from Supabase');

      const b = boyCount || 0;
      const g = girlCount || 0;

      // Seed with some initial aesthetic poll values if there are 0 votes, 
      // just so the initial UI isn't completely empty (e.g., 5-3 start)
      if (b === 0 && g === 0) {
        return { boy: 8, girl: 10, total: 18 };
      }

      return {
        boy: b,
        girl: g,
        total: b + g
      };
    } catch (e) {
      console.warn('Supabase fetch failed, using local storage fallback.', e);
    }
  }

  // Fallback Local Storage Mode
  const votes = getLocalVotes();
  const baseBoy = 8;
  const baseGirl = 10;
  
  const localBoy = votes.filter(v => v === 'boy').length;
  const localGirl = votes.filter(v => v === 'girl').length;

  return {
    boy: baseBoy + localBoy,
    girl: baseGirl + localGirl,
    total: baseBoy + baseGirl + localBoy + localGirl
  };
};

export const submitVote = async (gender: 'boy' | 'girl'): Promise<boolean> => {
  // Always register in localStorage so the client can't vote again
  localStorage.setItem('oh_baby_has_voted', gender);

  if (supabase) {
    try {
      const { error } = await supabase
        .from('gender_votes')
        .insert([{ gender }]);
      
      if (!error) return true;
      console.error('Supabase vote submission failed, using local storage backup:', error);
    } catch (e) {
      console.error('Error submitting vote to Supabase:', e);
    }
  }

  // Fallback Local Storage Mode
  const votes = getLocalVotes();
  votes.push(gender);
  localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(votes));
  return true;
};

export const getUserVote = (): 'boy' | 'girl' | null => {
  return localStorage.getItem('oh_baby_has_voted') as 'boy' | 'girl' | null;
};

// ==========================================
// NAME SUGGESTIONS SERVICES
// ==========================================

export const fetchNameSuggestions = async (): Promise<NameSuggestion[]> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('name_suggestions')
        .select('*')
        .order('likes', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        return data as NameSuggestion[];
      }
    } catch (e) {
      console.warn('Supabase fetch name suggestions failed, using local storage fallback.', e);
    }
  }

  // Fallback / Local Storage Mode
  const names = getLocalNames();
  // Sort by likes descending, then by date descending
  return [...names].sort((a, b) => b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const submitNameSuggestion = async (name: string): Promise<NameSuggestion | null> => {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // Capitalize name nicely (e.g. "oliver" -> "Oliver", "mary-jane" -> "Mary-Jane")
  const formattedName = trimmedName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('name_suggestions')
        .insert([{ name: formattedName, likes: 0 }])
        .select()
        .single();

      if (!error && data) {
        return data as NameSuggestion;
      }
      console.error('Supabase name submission failed, using local storage:', error);
    } catch (e) {
      console.error('Error submitting name to Supabase:', e);
    }
  }

  // Fallback Local Storage Mode
  const names = getLocalNames();
  const newName: NameSuggestion = {
    id: Math.random().toString(36).substring(2, 9),
    name: formattedName,
    likes: 0,
    created_at: new Date().toISOString()
  };
  names.push(newName);
  localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(names));
  return newName;
};

export const upvoteNameSuggestion = async (id: string, currentLikes: number): Promise<number> => {
  // Track upvoted items in localStorage so they can only toggle/upvote once per session
  const upvotedNames = JSON.parse(localStorage.getItem('oh_baby_upvoted_names') || '[]');
  const isUpvoted = upvotedNames.includes(id);

  let newLikesCount = currentLikes;
  let nextUpvotedList = [...upvotedNames];

  if (isUpvoted) {
    // Unlike
    newLikesCount = Math.max(0, currentLikes - 1);
    nextUpvotedList = nextUpvotedList.filter(nameId => nameId !== id);
  } else {
    // Like
    newLikesCount = currentLikes + 1;
    nextUpvotedList.push(id);
  }

  localStorage.setItem('oh_baby_upvoted_names', JSON.stringify(nextUpvotedList));

  if (supabase) {
    try {
      const { error } = await supabase
        .from('name_suggestions')
        .update({ likes: newLikesCount })
        .eq('id', id);

      if (!error) return newLikesCount;
      console.error('Supabase upvote update failed, using local storage backup:', error);
    } catch (e) {
      console.error('Error upvoting name in Supabase:', e);
    }
  }

  // Fallback Local Storage Mode
  const names = getLocalNames();
  const nameIndex = names.findIndex(n => n.id === id);
  if (nameIndex !== -1) {
    names[nameIndex].likes = newLikesCount;
    localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(names));
  }
  return newLikesCount;
};

export const getUpvotedNames = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('oh_baby_upvoted_names') || '[]');
  } catch {
    return [];
  }
};
