import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('auth');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUserData({ uid: currentUser.uid, ... doc.data() });
          }
        });
        setUser(currentUser);
        setPage('chat');
        return () => unsubUser();
      } else {
        setUser(null);
        setUserData(null);
        setPage('auth');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userData) setLoading(false);
  }, [userData]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading MYCircle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {page === 'auth' && <AuthPage setPage={setPage} />}
      {page === 'chat' && <ChatPage user={userData} setPage={setPage} />}
      {page === 'addFriend' && <AddFriendPage user={userData} setPage={setPage} />}
      {page === 'profile' && <ProfilePage user={userData} setPage={setPage} />}
    </div>
  );
}

// ==========================================
// 🔐 AUTH PAGE
// ==========================================
function AuthPage({ setPage }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (username.length < 3) {
          setError('Username must be at least 3 characters');
          setLoading(false);
          return;
        }

        const usernameQuery = query(
          collection(db, 'users'),
          where('usernameLower', '==', username.toLowerCase())
        );
        const usernameSnapshot = await getDocs(usernameQuery);
        
        if (! usernameSnapshot.empty) {
          setError('Username already taken');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          username: username,
          usernameLower: username.toLowerCase(),
          email: email,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=1e3a5f,1e40af,3730a3`,
          createdAt: serverTimestamp(),
          online: true,
          friends: []
        });
      }
    } catch (err) {
      let errorMsg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Email already registered';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password must be at least 6 characters';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMsg = 'Invalid email or password';
      }
      setError(errorMsg);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 100 100" className="logo-svg">
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="6"/>
                <circle cx="50" cy="25" r="8" fill="#60a5fa"/>
                <circle cx="75" cy="50" r="8" fill="#818cf8"/>
                <circle cx="50" cy="75" r="8" fill="#a78bfa"/>
                <circle cx="25" cy="50" r="8" fill="#38bdf8"/>
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="logo-text">MYCircle</span>
          </div>
          <p className="auth-subtitle">
            {isLogin ? 'Welcome back to your circle!' : 'Join your circle today'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {! isLogin && (
            <div className="input-group">
              <label>
                <span className="label-icon">👤</span>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value. replace(/\s/g, ''))}
                placeholder="Choose a unique username"
                required={! isLogin}
                maxLength={20}
              />
            </div>
          )}

          <div className="input-group">
            <label>
              <span className="label-icon">✉️</span>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="input-group">
            <label>
              <span className="label-icon">🔒</span>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="btn-loading"></span>
            ) : (
              <>
                {isLogin ? 'Login' : 'Create Account'}
                <span className="btn-icon">→</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account? "}
            <button 
              className="link-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>

      <p className="auth-credit">Made with 💙 in Malaysia</p>
    </div>
  );
}

// ==========================================
// 💬 CHAT PAGE
// ==========================================
function ChatPage({ user, setPage }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (! user?. friends?. length) {
      setFriends([]);
      return;
    }

    const friendsData = [];
    const unsubscribes = [];

    user.friends.forEach((friendId) => {
      const unsub = onSnapshot(doc(db, 'users', friendId), (doc) => {
        if (doc.exists()) {
          const friendData = { uid: friendId, ...doc.data() };
          const existingIndex = friendsData.findIndex(f => f.uid === friendId);
          if (existingIndex >= 0) {
            friendsData[existingIndex] = friendData;
          } else {
            friendsData. push(friendData);
          }
          setFriends([...friendsData]);
          
          if (selectedFriend?. uid === friendId) {
            setSelectedFriend(friendData);
          }
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user?. friends, selectedFriend?. uid]);

  useEffect(() => {
    if (! selectedFriend || !user) return;

    const chatId = [user.uid, selectedFriend.uid].sort().join('_');
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc. id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedFriend, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user?. uid) return;
    
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { online: true });

    const handleOffline = () => {
      updateDoc(userRef, { online:  false, lastSeen: serverTimestamp() });
    };

    window.addEventListener('beforeunload', handleOffline);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        updateDoc(userRef, { online:  false, lastSeen: serverTimestamp() });
      } else {
        updateDoc(userRef, { online:  true });
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleOffline);
      handleOffline();
    };
  }, [user?.uid]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    const chatId = [user.uid, selectedFriend.uid].sort().join('_');
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    const messageText = newMessage;
    setNewMessage('');

    await addDoc(messagesRef, {
      text: messageText,
      senderId: user.uid,
      senderName: user.username,
      createdAt: serverTimestamp()
    });
  };

  const handleLogout = async () => {
    if (user?. uid) {
      await updateDoc(doc(db, 'users', user.uid), { 
        online: false, 
        lastSeen: serverTimestamp() 
      });
    }
    await signOut(auth);
  };

  const formatTime = (timestamp) => {
    if (!timestamp?. toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute:  '2-digit' });
  };

  return (
    <div className="chat-container">
      <div className={`sidebar ${showSidebar ? 'show' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-small">
            <svg viewBox="0 0 100 100" className="logo-svg-small">
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient2)" strokeWidth="6"/>
              <circle cx="50" cy="25" r="6" fill="#60a5fa"/>
              <circle cx="75" cy="50" r="6" fill="#818cf8"/>
              <circle cx="50" cy="75" r="6" fill="#a78bfa"/>
              <circle cx="25" cy="50" r="6" fill="#38bdf8"/>
              <defs>
                <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
            <span>MYCircle</span>
          </div>
        </div>

        <div className="user-profile" onClick={() => setPage('profile')}>
          <img src={user?. avatar} alt="" className="avatar" />
          <div className="user-details">
            <h3>{user?.username}</h3>
            <span className="status online">● Online</span>
          </div>
          <span className="profile-arrow">›</span>
        </div>

        <div className="sidebar-actions">
          <button className="btn-add-friend" onClick={() => setPage('addFriend')}>
            <span className="btn-add-icon">+</span>
            Add Friend
          </button>
        </div>

        <div className="friends-section">
          <h4>Your Circle <span className="friend-count">{friends.length}</span></h4>
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="no-friends">
                <span className="no-friends-icon">👥</span>
                <p>Your circle is empty</p>
                <span className="no-friends-hint">Add friends to start chatting!</span>
              </div>
            ) : (
              friends.map(friend => (
                <div
                  key={friend.uid}
                  className={`friend-item ${selectedFriend?.uid === friend.uid ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFriend(friend);
                    setShowSidebar(false);
                  }}
                >
                  <div className="friend-avatar-wrapper">
                    <img src={friend.avatar} alt="" className="avatar-sm" />
                    <span className={`status-dot ${friend.online ? 'online' : 'offline'}`}></span>
                  </div>
                  <div className="friend-info">
                    <span className="friend-name">{friend.username}</span>
                    <span className={`friend-status ${friend.online ? 'online' : 'offline'}`}>
                      {friend.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      <div className="chat-area">
        {selectedFriend ?  (
          <>
            <div className="chat-header">
              <button 
                className="menu-btn mobile-only"
                onClick={() => setShowSidebar(true)}
              >
                ☰
              </button>
              <div className="chat-header-user">
                <div className="friend-avatar-wrapper">
                  <img src={selectedFriend. avatar} alt="" className="avatar-sm" />
                  <span className={`status-dot ${selectedFriend.online ? 'online' : 'offline'}`}></span>
                </div>
                <div>
                  <h3>{selectedFriend.username}</h3>
                  <span className={`header-status ${selectedFriend.online ? 'online' : 'offline'}`}>
                    {selectedFriend.online ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <span className="wave-emoji">👋</span>
                  <p>Say hello to {selectedFriend. username}!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`message ${msg.senderId === user.uid ? 'sent' : 'received'}`}
                  >
                    <div className="message-bubble">
                      <p>{msg.text}</p>
                      <span className="message-time">{formatTime(msg. createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                autoComplete="off"
              />
              <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" className="send-icon">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat">
            <button 
              className="menu-btn mobile-only"
              onClick={() => setShowSidebar(true)}
            >
              ☰
            </button>
            <div className="no-chat-content">
              <div className="no-chat-icon">
                <svg viewBox="0 0 100 100" className="logo-svg-large">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient3)" strokeWidth="4"/>
                  <circle cx="50" cy="25" r="8" fill="#60a5fa"/>
                  <circle cx="75" cy="50" r="8" fill="#818cf8"/>
                  <circle cx="50" cy="75" r="8" fill="#a78bfa"/>
                  <circle cx="25" cy="50" r="8" fill="#38bdf8"/>
                  <defs>
                    <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6"/>
                      <stop offset="100%" stopColor="#8b5cf6"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2>Welcome to MYCircle</h2>
              <p>Select a friend to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ➕ ADD FRIEND PAGE
// ==========================================
function AddFriendPage({ user, setPage }) {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSearchResult(null);
    setSearching(true);

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('usernameLower', '==', searchUsername.toLowerCase().trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('User not found.  Check the username and try again.');
      } else {
        const foundUser = { uid: snapshot.docs[0]. id, ...snapshot.docs[0].data() };
        
        if (foundUser.uid === user.uid) {
          setError("That's you! Try searching for someone else.");
        } else if (user.friends?. includes(foundUser.uid)) {
          setError(`${foundUser.username} is already in your circle! `);
        } else {
          setSearchResult(foundUser);
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
    setSearching(false);
  };

  const addFriend = async () => {
    if (!searchResult) return;
    setLoading(true);

    try {
      const myFriends = user.friends || [];
      await updateDoc(doc(db, 'users', user.uid), {
        friends: [...myFriends, searchResult.uid]
      });

      const theirFriends = searchResult. friends || [];
      await updateDoc(doc(db, 'users', searchResult.uid), {
        friends: [...theirFriends, user.uid]
      });

      setSuccess(`${searchResult.username} added to your circle!  🎉`);
      setSearchResult(null);
      setSearchUsername('');
      
      setTimeout(() => setPage('chat'), 2000);
    } catch (err) {
      setError('Failed to add friend. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="add-friend-container">
      <div className="add-friend-bg">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
      </div>

      <div className="add-friend-card">
        <button className="back-btn" onClick={() => setPage('chat')}>
          ← Back to Chat
        </button>

        <div className="add-friend-header">
          <div className="add-friend-icon">👥</div>
          <h2>Add to Circle</h2>
          <p>Search by username to add friends</p>
        </div>

        <form onSubmit={searchUser} className="search-form">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value. replace(/\s/g, ''))}
              placeholder="Enter username..."
              required
            />
            <button type="submit" className="search-btn" disabled={searching || ! searchUsername.trim()}>
              {searching ? '.. .' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="message-box error">
            <span>❌</span> {error}
          </div>
        )}
        
        {success && (
          <div className="message-box success">
            <span>✅</span> {success}
          </div>
        )}

        {searchResult && (
          <div className="search-result">
            <div className="result-card">
              <img src={searchResult.avatar} alt="" className="result-avatar" />
              <div className="result-info">
                <h3>{searchResult.username}</h3>
                <span className={`result-status ${searchResult.online ?  'online' : 'offline'}`}>
                  {searchResult.online ? '● Online' : '○ Offline'}
                </span>
              </div>
            </div>
            <button 
              className="btn-primary btn-add"
              onClick={addFriend}
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading"></span>
              ) : (
                <>
                  <span>+</span> Add to Circle
                </>
              )}
            </button>
          </div>
        )}

        <div className="add-friend-tip">
          <span>💡</span>
          <p>Ask your friend for their exact username</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 👤 PROFILE PAGE
// ==========================================
function ProfilePage({ user, setPage }) {
  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return 'Unknown';
    return timestamp.toDate().toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="profile-container">
      <div className="profile-bg">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
      </div>

      <div className="profile-card">
        <button className="back-btn" onClick={() => setPage('chat')}>
          ← Back to Chat
        </button>

        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <img src={user?. avatar} alt="" className="profile-avatar" />
            <span className="profile-status-dot online"></span>
          </div>
          <h2>{user?.username}</h2>
          <p className="profile-email">{user?.email}</p>
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-number">{user?.friends?.length || 0}</span>
            <span className="stat-label">Friends</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">●</span>
            <span className="stat-label">Online</span>
          </div>
        </div>

        <div className="profile-info">
          <div className="info-item">
            <span className="info-icon">📅</span>
            <div>
              <span className="info-label">Joined</span>
              <span className="info-value">{formatDate(user?.createdAt)}</span>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">🆔</span>
            <div>
              <span className="info-label">Username</span>
              <span className="info-value">@{user?.username}</span>
            </div>
          </div>
        </div>

        <div className="profile-footer">
          <p>MYCircle • Made with 💙 in Malaysia</p>
        </div>
      </div>
    </div>
  );
}

export default App;