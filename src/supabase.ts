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
// Define Types
export interface NameSuggestion {
  id: string;
  name: string;
  suggested_by: string;
  likes: number;
  created_at: string;
}

export interface VoteStats {
  boy: number;
  girl: number;
  total: number;
  boyVoters: string[];
  girlVoters: string[];
}

export interface GenderVote {
  gender: 'boy' | 'girl';
  voter_name: string;
}

// Local Storage Fallback Keys
const LOCAL_STORAGE_VOTES_KEY = 'oh_baby_local_votes';
const LOCAL_STORAGE_NAMES_KEY = 'oh_baby_local_names';

// ==========================================
// fallback local helpers
// ==========================================

const getLocalVotes = (): GenderVote[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VOTES_KEY);
    if (!raw) {
      // Seed with some cute initial votes
      const initialMockVotes: GenderVote[] = [
        { gender: 'boy', voter_name: 'Uncle Jack' },
        { gender: 'boy', voter_name: 'Aunt Sarah' },
        { gender: 'girl', voter_name: 'Grandma Ellen' },
        { gender: 'girl', voter_name: 'Cousin Leo' },
        { gender: 'girl', voter_name: 'Mama' },
        { gender: 'boy', voter_name: 'Papa' },
      ];
      localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(initialMockVotes));
      return initialMockVotes;
    }
    const parsed = JSON.parse(raw);
    return parsed.map((v: any) => {
      if (typeof v === 'string') {
        return { gender: v as 'boy' | 'girl', voter_name: 'Anonymous Friend' };
      }
      return v;
    });
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
        { id: '1', name: 'Aurelia', suggested_by: 'Grandma Ellen', likes: 18, created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
        { id: '2', name: 'Oliver', suggested_by: 'Uncle Jack', likes: 15, created_at: new Date(Date.now() - 3600000 * 12).toISOString() },
        { id: '3', name: 'Hazel', suggested_by: 'Aunt Sarah', likes: 24, created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
        { id: '4', name: 'Milo', suggested_by: 'Cousin Leo', likes: 11, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
        { id: '5', name: 'Freya', suggested_by: 'Mama', likes: 29, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
        { id: '6', name: 'Leo', suggested_by: 'Papa', likes: 9, created_at: new Date().toISOString() },
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
      const { data, error } = await supabase
        .from('gender_votes')
        .select('*');

      if (error) throw new Error('Failed to fetch from Supabase');

      if (data) {
        const boyVotes = data.filter((v: any) => v.gender === 'boy');
        const girlVotes = data.filter((v: any) => v.gender === 'girl');
        const b = boyVotes.length;
        const g = girlVotes.length;

        // Seed with some initial aesthetic poll values if there are 0 votes, 
        // just so the initial UI isn't completely empty
        if (b === 0 && g === 0) {
          return { 
            boy: 8, 
            girl: 10, 
            total: 18,
            boyVoters: ['Uncle Jack', 'Aunt Sarah', 'Papa'],
            girlVoters: ['Grandma Ellen', 'Cousin Leo', 'Mama']
          };
        }

        return {
          boy: b,
          girl: g,
          total: b + g,
          boyVoters: boyVotes.map((v: any) => v.voter_name || 'Anonymous Friend'),
          girlVoters: girlVotes.map((v: any) => v.voter_name || 'Anonymous Friend')
        };
      }
    } catch (e) {
      console.warn('Supabase fetch failed, using local storage fallback.', e);
    }
  }

  // Fallback Local Storage Mode
  const votes = getLocalVotes();
  const boyVotes = votes.filter(v => v.gender === 'boy');
  const girlVotes = votes.filter(v => v.gender === 'girl');

  return {
    boy: boyVotes.length,
    girl: girlVotes.length,
    total: votes.length,
    boyVoters: boyVotes.map(v => v.voter_name),
    girlVoters: girlVotes.map(v => v.voter_name)
  };
};

export const submitVote = async (gender: 'boy' | 'girl', voterName: string): Promise<boolean> => {
  // Always register in localStorage so the client can't vote again
  localStorage.setItem('oh_baby_has_voted', gender);
  localStorage.setItem('oh_baby_voter_name', voterName);

  if (supabase) {
    try {
      const { error } = await supabase
        .from('gender_votes')
        .insert([{ gender, voter_name: voterName }]);
      
      if (!error) return true;
      console.error('Supabase vote submission failed, using local storage backup:', error);
    } catch (e) {
      console.error('Error submitting vote to Supabase:', e);
    }
  }

  // Fallback Local Storage Mode
  const votes = getLocalVotes();
  votes.push({ gender, voter_name: voterName });
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

export const submitNameSuggestion = async (nameInput: string, suggestedBy: string): Promise<NameSuggestion[] | null> => {
  const namesList = nameInput
    .split(',')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  if (namesList.length === 0) return null;

  const formattedNames = namesList.map(name => {
    // Capitalize name nicely (e.g. "oliver" -> "Oliver", "mary-jane" -> "Mary-Jane")
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  });

  const suggestedByFormatted = suggestedBy.trim() || 'Anonymous';

  if (supabase) {
    try {
      const recordsToInsert = formattedNames.map(formattedName => ({
        name: formattedName,
        suggested_by: suggestedByFormatted,
        likes: 0
      }));

      const { data, error } = await supabase
        .from('name_suggestions')
        .insert(recordsToInsert)
        .select();

      if (!error && data) {
        return data as NameSuggestion[];
      }
      console.error('Supabase name submission failed, using local storage:', error);
    } catch (e) {
      console.error('Error submitting name to Supabase:', e);
    }
  }

  // Fallback Local Storage Mode
  const names = getLocalNames();
  const addedNames: NameSuggestion[] = [];

  formattedNames.forEach(formattedName => {
    const newName: NameSuggestion = {
      id: Math.random().toString(36).substring(2, 9),
      name: formattedName,
      suggested_by: suggestedByFormatted,
      likes: 0,
      created_at: new Date().toISOString()
    };
    names.push(newName);
    addedNames.push(newName);
  });

  localStorage.setItem(LOCAL_STORAGE_NAMES_KEY, JSON.stringify(names));
  return addedNames;
};

export const upvoteNameSuggestion = async (id: string, currentLikes: number): Promise<number> => {
  // Track upvoted items in localStorage so they can only upvote once
  const upvotedNames = JSON.parse(localStorage.getItem('oh_baby_upvoted_names') || '[]');
  const isUpvoted = upvotedNames.includes(id);

  if (isUpvoted) {
    // Already voted, do nothing (strict one user one vote)
    return currentLikes;
  }

  const newLikesCount = currentLikes + 1;
  const nextUpvotedList = [...upvotedNames, id];
  localStorage.setItem('oh_baby_upvoted_names', JSON.stringify(nextUpvotedList));

  if (supabase) {
    try {
      const { error } = await supabase.rpc('increment_name_likes', { name_id: id });

      if (!error) return newLikesCount;
      
      // Fallback to direct table update if RPC is missing
      const { error: fallbackError } = await supabase
        .from('name_suggestions')
        .update({ likes: newLikesCount })
        .eq('id', id);

      if (!fallbackError) return newLikesCount;
      console.error('Supabase secure RPC upvote failed, and fallback table update failed:', fallbackError);
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
