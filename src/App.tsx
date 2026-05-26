import { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Sparkles, 
  Send, 
  Database, 
  Check, 
  Loader2, 
  X, 
  BookOpen, 
  Info, 
  AlertCircle,
  Search,
  SlidersHorizontal,
  User
} from 'lucide-react';
import { 
  fetchVoteStats, 
  submitVote, 
  getUserVote, 
  fetchNameSuggestions, 
  submitNameSuggestion, 
  upvoteNameSuggestion, 
  getUpvotedNames, 
  isSupabaseConfigured,
  supabase
} from './supabase';
import type { NameSuggestion, VoteStats } from './supabase';

function App() {
  // Database / Connection State
  const [stats, setStats] = useState<VoteStats>({ boy: 0, girl: 0, total: 0, boyVoters: [], girlVoters: [] });
  const [names, setNames] = useState<NameSuggestion[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  
  // User Profile Name State
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('oh_baby_user_name') || '';
  });
  const [userNameError, setUserNameError] = useState('');

  // Voting State
  const [userVote, setUserVote] = useState<'boy' | 'girl' | null>(null);
  
  // Name Input State
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'alphabetical'>('popular');

  // UI State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Canvas Ref for Confetti
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ==========================================
  // INITIAL LOAD & SUBSCRIPTIONS
  // ==========================================

  const loadStats = async () => {
    try {
      const voteStats = await fetchVoteStats();
      setStats(voteStats);
      
      // Self-clearing vote mechanism: If stats drop to 0, automatically reset vote state
      if (voteStats.total === 0) {
        localStorage.removeItem('oh_baby_has_voted');
        setUserVote(null);
      }
    } catch (e) {
      showToast('Could not fetch latest voting stats.', 'error');
    }
  };

  const loadNames = async () => {
    try {
      const suggestions = await fetchNameSuggestions();
      setNames(suggestions);
    } catch (e) {
      showToast('Could not fetch name suggestions.', 'error');
    }
  };

  // Sync username to LocalStorage
  useEffect(() => {
    localStorage.setItem('oh_baby_user_name', userName);
  }, [userName]);

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      
      // Load liked list
      setUpvotedIds(getUpvotedNames());

      // Load stats and names
      try {
        const [voteStats, suggestions] = await Promise.all([
          fetchVoteStats(),
          fetchNameSuggestions()
        ]);
        
        setStats(voteStats);
        setNames(suggestions);

        let currentVote = getUserVote();
        // Self-clearing on load: If total votes in database is 0, clear local vote badge
        if (voteStats.total === 0 && currentVote !== null) {
          localStorage.removeItem('oh_baby_has_voted');
          currentVote = null;
        }
        setUserVote(currentVote);
      } catch (e) {
        showToast('Error loading initial data.', 'error');
      }
      
      setIsLoading(false);
    };

    initializeData();

    // ==========================================
    // SUPABASE REAL-TIME LISTENER
    // ==========================================
    if (supabase) {
      const client = supabase;
      // Subscribe to all changes (inserts, deletes/resets) on gender votes
      const votesChannel = client
        .channel('realtime_votes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gender_votes' }, () => {
          loadStats();
        })
        .subscribe();

      // Subscribe to name suggestions changes
      const namesChannel = client
        .channel('realtime_names')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'name_suggestions' }, () => {
          loadNames();
        })
        .subscribe();

      return () => {
        client.removeChannel(votesChannel);
        client.removeChannel(namesChannel);
      };
    }
  }, []);

  // ==========================================
  // CONFETTI EFFECT
  // ==========================================
  useEffect(() => {
    if (!showConfetti || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#79AECB', '#CE909A', '#88A795', '#CBB084', '#F4F7F5', '#ECD2D6'];
    const particleCount = 150;
    const particles: any[] = [];

    class Particle {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height - canvas.height;
        this.size = Math.random() * 8 + 4;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 4 + 2;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 4 - 2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height) {
          this.y = -20;
          this.x = Math.random() * canvas.width;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Resize listener
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Stop after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [showConfetti]);

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  };

  // ==========================================
  // ACTIONS / LOGIC
  // ==========================================

  const handleVote = async (gender: 'boy' | 'girl') => {
    if (userVote) return;
    
    // Enforce name capture
    const trimmedVoterName = userName.trim();
    if (!trimmedVoterName) {
      setUserNameError('Please introduce yourself by entering your name first!');
      document.getElementById('user-name-input')?.focus();
      showToast('Name is required to cast a prediction.', 'error');
      return;
    }

    setUserNameError('');
    setIsSubmittingVote(true);
    try {
      const success = await submitVote(gender, trimmedVoterName);
      if (success) {
        setUserVote(gender);
        // Refresh local stats state
        await loadStats();
        // Trigger confetti!
        setShowConfetti(true);
        showToast(`Thank you, ${trimmedVoterName}! Your prediction for Team ${gender === 'boy' ? 'Boy 💙' : 'Girl 💗'} has been counted!`, 'success');
      } else {
        showToast('Something went wrong submitting your vote.', 'error');
      }
    } catch (e) {
      showToast('Voting failed. Please check connection.', 'error');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce name capture
    const trimmedSuggestedBy = userName.trim();
    if (!trimmedSuggestedBy) {
      setUserNameError('Please introduce yourself by entering your name first!');
      document.getElementById('user-name-input')?.focus();
      showToast('Name is required to suggest baby names.', 'error');
      return;
    }

    const nameToSubmit = newName.trim();
    
    if (!nameToSubmit) {
      setNameError('Name cannot be empty.');
      return;
    }

    if (!/^[A-Za-z\s,-]+$/.test(nameToSubmit)) {
      setNameError('Please use letters, spaces, hyphens, or commas.');
      return;
    }

    setNameError('');
    setIsSubmittingName(true);

    try {
      const addedNames = await submitNameSuggestion(nameToSubmit, trimmedSuggestedBy);
      if (addedNames && addedNames.length > 0) {
        setNewName('');
        // Reload list or append locally
        await loadNames();
        const namesString = addedNames.map(n => n.name).join(', ');
        showToast(`✨ Added: "${namesString}" successfully!`, 'success');
      } else {
        showToast('Failed to add the name suggestion.', 'error');
      }
    } catch (e) {
      showToast('Error connecting to database.', 'error');
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleLikeToggle = async (nameObj: NameSuggestion) => {
    const isUpvoted = upvotedIds.includes(nameObj.id);
    if (isUpvoted) {
      showToast('You have already voted for this name!', 'info');
      return;
    }
    
    try {
      const updatedLikes = await upvoteNameSuggestion(nameObj.id, nameObj.likes);
      
      // Update UI immediately
      setNames(prevNames => 
        prevNames.map(n => n.id === nameObj.id ? { ...n, likes: updatedLikes } : n)
      );

      // Append in local array
      setUpvotedIds(prev => [...prev, nameObj.id]);
      showToast(`Voted for ${nameObj.name}! 💖`, 'success');
    } catch (e) {
      showToast('Failed to register vote.', 'error');
    }
  };

  // ==========================================
  // STATS FORMATTING
  // ==========================================
  const boyPct = stats.total > 0 ? Math.round((stats.boy / stats.total) * 100) : 50;
  const girlPct = stats.total > 0 ? 100 - boyPct : 50;

  // ==========================================
  // FILTERS AND SEARCH
  // ==========================================
  const filteredAndSortedNames = names
    .filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'popular') {
        return b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-cream-light font-sans text-charcoal flex flex-col items-center">
      
      {/* Confetti Overlay */}
      {showConfetti && <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />}

      {/* Boho Blur Circles Backdrop */}
      <div className="absolute top-[10%] left-[-15%] w-80 h-80 rounded-full bg-babyblue-200/20 blur-3xl float-slow pointer-events-none" />
      <div className="absolute top-[40%] right-[-15%] w-96 h-96 rounded-full bg-rose-200/20 blur-3xl float-delayed pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-80 h-80 rounded-full bg-sage-200/20 blur-3xl float-slow pointer-events-none" />
      <div className="absolute bottom-[30%] right-[10%] w-72 h-72 rounded-full bg-sand-200/15 blur-3xl float-delayed pointer-events-none" />

      {/* ==========================================
          TOP NOTIFICATION BAR (DEMO BANNER)
          ========================================== */}
      {!isSupabaseConfigured && (
        <div className="w-full bg-gradient-to-r from-sand-100 via-cream-dark to-sand-100 text-charcoal border-b border-sand-200 px-4 py-2 text-xs flex justify-between items-center z-40 transition-all duration-300">
          <div className="flex items-center gap-1.5 mx-auto text-center font-medium">
            <Database className="w-3.5 h-3.5 text-sand-dark animate-pulse" />
            <span>Running in <strong>Demo Mode</strong> (LocalStorage).</span>
            <button 
              onClick={() => setShowSqlModal(true)}
              className="text-sage-dark hover:text-sage-dark/80 underline font-semibold flex items-center gap-0.5 ml-1 transition-all"
              id="setup-guide-btn"
            >
              Connect to Supabase
              <BookOpen className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          HEADER / HERO SECTION
          ========================================== */}
      <header className="w-full max-w-md px-6 pt-8 pb-4 text-center z-10 flex flex-col items-center">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-white shadow-sm border border-sand-100 mb-4 pulse-gentle">
          <Sparkles className="w-6 h-6 text-sand" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-charcoal mb-2 font-serif relative">
          Oh Baby! <span className="text-sand">✨</span>
        </h1>
        <p className="text-sm text-charcoal-light font-medium max-w-xs leading-relaxed">
          Welcome to our nursery prediction pool! Cast your vote on the gender and suggest beautiful name inspirations.
        </p>
      </header>

      {/* ==========================================
          MAIN CARD CONTAINER
          ========================================== */}
      <main className="w-full max-w-md px-4 pb-20 flex-grow z-10 flex flex-col gap-6">
        
        {/* ==========================================
            SECTION 0: USER PROFILE / IDENTIFICATION
            ========================================== */}
        <section className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-sand-100 transition-all duration-300">
          <div className="flex flex-col gap-2">
            <label htmlFor="user-name-input" className="text-xs font-bold text-sand-dark tracking-wider block font-sans uppercase flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-sand-dark" />
              Introduce Yourself
            </label>
            <input
              type="text"
              id="user-name-input"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                if (userNameError) setUserNameError('');
              }}
              placeholder="Enter your name (e.g. Aunt Sarah, Cousin Leo)"
              className={`w-full bg-cream-light border ${userNameError ? 'border-rose-300 ring-1 ring-rose-300' : 'border-sand-200'} rounded-full py-2.5 px-4 text-xs font-semibold text-charcoal placeholder:text-charcoal-light/40 focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all`}
              maxLength={40}
            />
            {userNameError ? (
              <span className="text-[10px] text-rose-dark font-bold ml-2 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {userNameError}
              </span>
            ) : (
              <span className="text-[9px] text-charcoal-light/60 font-semibold ml-2">
                This is how your name suggestions and gender predictions will be labeled!
              </span>
            )}
          </div>
        </section>

        {/* ==========================================
            SECTION 1: GENDER VOTING / PREDICTOR
            ========================================== */}
        <section className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-sand-100 transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1.5 rounded-lg bg-sand-50 text-sand-dark font-semibold text-xs border border-sand-100">Zone 1</span>
            <h2 className="text-xl font-bold font-serif text-charcoal">The Prediction Zone</h2>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-sand animate-spin" />
              <p className="text-xs text-charcoal-light font-medium">Reading the nursery stars...</p>
            </div>
          ) : !userVote ? (
            /* STATE A: BEFORE VOTING */
            <div>
              <p className="text-xs text-charcoal-light mb-4 font-medium text-center">
                What do you think the baby will be? Tap your prediction!
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* TEAM BOY */}
                <button
                  onClick={() => handleVote('boy')}
                  disabled={isSubmittingVote}
                  className="group relative overflow-hidden bg-gradient-to-b from-babyblue-50 to-white hover:from-babyblue-100/50 hover:to-babyblue-50 border border-babyblue-100 hover:border-babyblue-300 rounded-2xl p-5 text-center transition-all duration-300 shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                  id="vote-boy-btn"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-babyblue-200/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-500" />
                  <div className="text-3xl mb-2 text-babyblue select-none">👶🏼</div>
                  <h3 className="font-semibold text-sm text-babyblue-dark tracking-wide font-sans">TEAM BOY</h3>
                  <span className="text-[10px] text-babyblue-dark/60 font-medium block mt-0.5">Click to Guess</span>
                </button>

                {/* TEAM GIRL */}
                <button
                  onClick={() => handleVote('girl')}
                  disabled={isSubmittingVote}
                  className="group relative overflow-hidden bg-gradient-to-b from-rose-50 to-white hover:from-rose-100/50 hover:to-rose-50 border border-rose-100 hover:border-rose-300 rounded-2xl p-5 text-center transition-all duration-300 shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                  id="vote-girl-btn"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-rose-200/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-500" />
                  <div className="text-3xl mb-2 text-rose select-none">👧🏼</div>
                  <h3 className="font-semibold text-sm text-rose-dark tracking-wide font-sans">TEAM GIRL</h3>
                  <span className="text-[10px] text-rose-dark/60 font-medium block mt-0.5">Click to Guess</span>
                </button>
              </div>
            </div>
          ) : (
            /* STATE B: AFTER VOTING */
            <div className="space-y-5 animate-fadeIn">
              
              {/* Voted Badge */}
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-sand-100/50 border border-sand-200 max-w-xs mx-auto">
                <Check className="w-4 h-4 text-sand-dark stroke-[3px]" />
                <span className="text-xs font-bold text-sand-dark tracking-wide font-sans">
                  YOU VOTED TEAM {userVote.toUpperCase()}! {userVote === 'boy' ? '💙' : '💗'}
                </span>
              </div>

              {/* Progress Poll Display */}
              <div className="space-y-4">
                {/* Stats Numbers */}
                <div className="flex justify-between items-end px-1">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-babyblue-dark tracking-widest block font-sans">BOY</span>
                    <span className="text-2xl font-extrabold font-serif text-babyblue-dark">{boyPct}%</span>
                    <span className="text-[10px] text-charcoal-light block mt-0.5">{stats.boy} {stats.boy === 1 ? 'vote' : 'votes'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-rose-dark tracking-widest block font-sans">GIRL</span>
                    <span className="text-2xl font-extrabold font-serif text-rose-dark">{girlPct}%</span>
                    <span className="text-[10px] text-charcoal-light block mt-0.5">{stats.girl} {stats.girl === 1 ? 'vote' : 'votes'}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 w-full bg-cream rounded-full overflow-hidden flex border border-sand-100/50 p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-babyblue-300 to-babyblue rounded-l-full transition-all duration-1000 ease-out"
                    style={{ width: `${boyPct}%` }}
                  />
                  <div 
                    className="h-full bg-gradient-to-l from-rose-300 to-rose rounded-r-full transition-all duration-1000 ease-out"
                    style={{ width: `${girlPct}%` }}
                  />
                </div>

                {/* Voter lists! */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-sand-100/50 text-[11px]">
                  <div className="space-y-1">
                    <span className="font-bold text-[9px] text-babyblue-dark tracking-wider block font-sans uppercase">💙 Team Boy Voters</span>
                    <div className="text-charcoal-light font-medium max-h-24 overflow-y-auto pr-1 text-[10px] leading-relaxed break-words">
                      {stats.boyVoters && stats.boyVoters.length > 0 ? (
                        stats.boyVoters.join(', ')
                      ) : (
                        <span className="italic text-charcoal-light/40">No votes yet</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-right border-l border-sand-100/50 pl-4">
                    <span className="font-bold text-[9px] text-rose-dark tracking-wider block font-sans uppercase">💗 Team Girl Voters</span>
                    <div className="text-charcoal-light font-medium max-h-24 overflow-y-auto pr-1 text-[10px] leading-relaxed break-words">
                      {stats.girlVoters && stats.girlVoters.length > 0 ? (
                        stats.girlVoters.join(', ')
                      ) : (
                        <span className="italic text-charcoal-light/40">No votes yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total Stats Footer */}
                <p className="text-[10px] text-center text-charcoal-light/70 font-semibold pt-1">
                  {stats.total} total predictions cast by friends & family
                </p>
              </div>

            </div>
          )}
        </section>

        {/* ==========================================
            SECTION 2: NAME SUGGESTION HUB
            ========================================== */}
        <section className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-sand-100 flex flex-col gap-5 transition-all duration-300">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sand-50 text-sand-dark font-semibold text-xs border border-sand-100">Zone 2</span>
              <h2 className="text-xl font-bold font-serif text-charcoal">Name Inspirations</h2>
            </div>
            <span className="text-xs text-charcoal-light font-medium">
              {names.length} {names.length === 1 ? 'name' : 'names'} listed
            </span>
          </div>

          {/* Minimalist Centered Input Form */}
          <div className="flex flex-col gap-2">
            {/* Instruction about adding multiple names */}
            <p className="text-[10px] text-charcoal-light font-semibold flex items-center gap-1.5 bg-cream/50 px-3.5 py-2 rounded-2xl border border-sand-100/60 leading-normal">
              <Info className="w-3.5 h-3.5 text-sand-dark flex-shrink-0" />
              <span>💡 Add multiple names at once by separating them with commas (e.g. <em>Noah, Lily, Joy</em>)!</span>
            </p>

            <form onSubmit={handleNameSubmit} className="relative">
              <div className="flex flex-col gap-1">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Suggest name(s)..."
                    className={`w-full bg-cream-light border ${nameError ? 'border-rose-300' : 'border-sand-200'} rounded-full py-3 pl-5 pr-14 text-sm font-medium text-charcoal placeholder:text-charcoal-light/40 focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all`}
                    disabled={isSubmittingName}
                    id="name-input"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingName}
                    className="absolute right-1.5 bg-sage hover:bg-sage-dark text-white rounded-full p-2.5 transition-colors disabled:opacity-50 shadow-sm"
                    id="submit-name-btn"
                    title="Submit name"
                  >
                    {isSubmittingName ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {nameError && (
                  <span className="text-[10px] text-rose-dark font-bold ml-4 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {nameError}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Search, Sort, Filter Submenu */}
          <div className="flex flex-col gap-3 border-t border-sand-100/50 pt-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-charcoal-light/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search suggested names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-cream-light/60 border border-sand-100 rounded-full py-1.5 pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-sand-300 placeholder:text-charcoal-light/35"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-light hover:text-charcoal"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Pills */}
            <div className="flex items-center gap-2 justify-between">
              <span className="text-[10px] text-charcoal-light font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                SORT BY
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSortBy('popular')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${sortBy === 'popular' ? 'bg-sand text-white border-sand' : 'bg-transparent text-charcoal-light border-sand-200 hover:border-sand-300'}`}
                >
                  Most Liked
                </button>
                <button
                  onClick={() => setSortBy('newest')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${sortBy === 'newest' ? 'bg-sand text-white border-sand' : 'bg-transparent text-charcoal-light border-sand-200 hover:border-sand-300'}`}
                >
                  Newest
                </button>
                <button
                  onClick={() => setSortBy('alphabetical')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${sortBy === 'alphabetical' ? 'bg-sand text-white border-sand' : 'bg-transparent text-charcoal-light border-sand-200 hover:border-sand-300'}`}
                >
                  A-Z
                </button>
              </div>
            </div>

          </div>

          {/* Grid display of cards */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-6 h-6 text-sand animate-spin" />
              <p className="text-[10px] text-charcoal-light">Reading baby book suggestions...</p>
            </div>
          ) : filteredAndSortedNames.length === 0 ? (
            <div className="text-center py-10 bg-cream/30 border border-dashed border-sand-200/80 rounded-2xl">
              <p className="text-xs text-charcoal-light/70 font-medium">
                {searchQuery ? 'No names match your search.' : 'No names suggested yet. Be the first!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {filteredAndSortedNames.map((nameObj) => {
                const isLiked = upvotedIds.includes(nameObj.id);
                return (
                  <div
                    key={nameObj.id}
                    className="group bg-cream-light/40 hover:bg-white border border-sand-100 hover:border-sand-200/80 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm hover:shadow transition-all duration-300 animate-fadeIn"
                  >
                    <div className="flex flex-col min-w-0 flex-grow">
                      {/* Name displays with word breaking enabled to support long names */}
                      <span className="font-serif font-semibold text-sm text-charcoal break-words leading-tight">
                        {nameObj.name}
                      </span>
                      <span className="text-[9px] text-charcoal-light/60 font-semibold mt-0.5 block truncate" title={`Suggested by ${nameObj.suggested_by}`}>
                        by {nameObj.suggested_by || 'Anonymous'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleLikeToggle(nameObj)}
                      disabled={isLiked}
                      className={`flex items-center gap-1 py-1.5 px-2.5 rounded-full border text-[10px] font-bold transition-all ${
                        isLiked 
                          ? 'bg-rose-50/70 border-rose-100 text-rose-dark cursor-default' 
                          : 'bg-white border-sand-100 text-charcoal-light hover:border-rose-200 group-hover:bg-rose-50/20 active:scale-95'
                      }`}
                      aria-label={isLiked ? `${nameObj.name} liked` : `Like ${nameObj.name}`}
                      id={`like-btn-${nameObj.id}`}
                    >
                      <Heart 
                        className={`w-3.5 h-3.5 transition-all ${isLiked ? 'fill-rose text-rose stroke-[2.5px] scale-105' : 'text-charcoal-light/60 group-hover:text-rose'}`} 
                      />
                      <span>{nameObj.likes}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </section>

      </main>

      {/* ==========================================
          TOAST SYSTEM
          ========================================== */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-gentle">
          <div className={`px-4 py-2.5 rounded-full shadow-md text-xs font-semibold flex items-center gap-2 border ${
            toastMessage.type === 'success' 
              ? 'bg-sage-50 border-sage-200 text-sage-dark' 
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-dark'
              : 'bg-sand-50 border-sand-200 text-sand-dark'
          }`}>
            {toastMessage.type === 'success' && <Check className="w-3.5 h-3.5 stroke-[2.5px]" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
            {toastMessage.type === 'info' && <Info className="w-3.5 h-3.5" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* ==========================================
          FOOTER
          ========================================== */}
      <footer className="w-full text-center py-6 text-[10px] font-bold text-charcoal-light/60 border-t border-sand-100/50 mt-auto bg-white/20 backdrop-blur-sm z-10">
        <p>Made with love • Oh Baby! Gender Predictor</p>
      </footer>

      {/* ==========================================
          MODAL: SUPABASE SETUP INSTRUCTIONS
          ========================================== */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" id="supabase-modal">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
            onClick={() => setShowSqlModal(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto shadow-xl border border-sand-100 flex flex-col gap-4 animate-scaleUp">
            
            <button
              onClick={() => setShowSqlModal(false)}
              className="absolute right-4 top-4 text-charcoal-light hover:text-charcoal p-1.5 rounded-full hover:bg-cream transition-colors"
              id="close-modal-btn"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sand-dark" />
              <h2 className="text-xl font-bold font-serif">Supabase Setup Guide</h2>
            </div>

            <p className="text-xs text-charcoal-light leading-relaxed">
              To connect this application to a live, global Supabase backend (so voting results and names update in real-time across all family devices), follow these quick steps:
            </p>

            <div className="space-y-4">
              
              <div>
                <span className="text-[10px] font-bold text-sand-dark bg-sand-50 border border-sand-200 px-2 py-0.5 rounded-md font-sans">STEP 1</span>
                <p className="text-xs font-semibold text-charcoal mt-1">Create Tables in Supabase SQL Editor</p>
                <p className="text-[10px] text-charcoal-light mb-2">Go to SQL Editor in your Supabase dashboard and run this command:</p>
                
                <div className="relative bg-cream p-3 rounded-xl border border-sand-100 max-h-48 overflow-y-auto">
                  <pre className="text-[9px] font-mono text-charcoal leading-normal whitespace-pre-wrap select-all">
{`CREATE TABLE IF NOT EXISTS public.gender_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('boy', 'girl')),
  voter_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.gender_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.gender_votes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON public.gender_votes FOR INSERT TO public WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.name_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  suggested_by VARCHAR(100) NOT NULL,
  likes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.name_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.name_suggestions FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON public.name_suggestions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.name_suggestions FOR UPDATE TO public USING (true) WITH CHECK (true);

-- SECURE ATOMIC RPC Counters (Eliminates Race Conditions & Upvote Tampering)
CREATE OR REPLACE FUNCTION public.increment_name_likes(name_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.name_suggestions
  SET likes = likes + 1
  WHERE id = name_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
                  </pre>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-sand-dark bg-sand-50 border border-sand-200 px-2 py-0.5 rounded-md font-sans">STEP 2</span>
                <p className="text-xs font-semibold text-charcoal mt-1">Define Local Environment Variables</p>
                <p className="text-[10px] text-charcoal-light mb-1">Create a <code>.env</code> file in your project root with your credentials:</p>
                <div className="bg-cream p-3 rounded-xl border border-sand-100 font-mono text-[9px] text-charcoal leading-relaxed">
                  VITE_SUPABASE_URL=https://your-project-id.supabase.co<br />
                  VITE_SUPABASE_ANON_KEY=your-anon-public-key
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-sand-dark bg-sand-50 border border-sand-200 px-2 py-0.5 rounded-md font-sans">STEP 3</span>
                <p className="text-xs font-semibold text-charcoal mt-1">Deploy on Vercel</p>
                <p className="text-[10px] text-charcoal-light leading-relaxed">
                  When publishing to Vercel, just add these same two environment variables inside Vercel Project Settings!
                </p>
              </div>

            </div>

            <button
              onClick={() => setShowSqlModal(false)}
              className="w-full bg-sand hover:bg-sand-dark text-white rounded-full py-2.5 font-bold text-xs shadow transition-colors mt-2"
              id="got-it-modal-btn"
            >
              Got it! Let's Go!
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;
