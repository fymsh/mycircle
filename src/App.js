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
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  arrayRemove
} from 'firebase/firestore';
import './App.css';

const EMOJIS = ["😀","😂","👍","😮","😢","❤️","🔥"];

function generateTagStr() {
  return Array.from({ length: 4 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join('');
}

function getProfileUrl({ username, tag }) {
  const loc = window.location.origin;
  return `${loc}/profile?u=${encodeURIComponent(username)}&t=${encodeURIComponent(tag)}`;
}

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('auth');
  const [profileLink, setProfileLink] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(userRef, async (docu) => {
          if (docu.exists()) {
            let d = docu.data();
            if (!d.tag && !(d.username === 'fymm555' || d.email === 'fahimbovak@gmail.com')) {
              let unique = false, finalTag = "";
              for (let i = 0; i < 10 && !unique; i++) {
                const candidate = generateTagStr();
                const tagQuery = query(
                  collection(db, 'users'),
                  where('usernameLower', '==', d.usernameLower),
                  where('tag', '==', candidate)
                );
                const tagSnap = await getDocs(tagQuery);
                if (tagSnap.empty) {
                  finalTag = candidate;
                  unique = true;
                }
              }
              if (unique) {
                await updateDoc(userRef, { tag: finalTag });
                d.tag = finalTag;
              }
            }
            setUserData({ uid: currentUser.uid, ...d });
            setProfileLink(getProfileUrl({ username: d.username, tag: d.tag || '' }));
          }
        });
        setUser(currentUser);
        setPage(window.location.pathname === '/profile' ? 'profile' : 'chat');
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
      {page === 'chat' && <ChatPage user={userData} setPage={setPage} profileLink={profileLink} />}
      {page === 'addFriend' && <AddFriendPage user={userData} setPage={setPage} />}
      {page === 'profile' && <ProfilePage user={userData} setPage={setPage} profileLink={profileLink} />}
    </div>
  );
}

function AuthPage({ setPage }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generateTag = async (username) => {
    for (let i = 0; i < 10; i++) {
      const tag = generateTagStr();
      const tagQuery = query(
        collection(db, 'users'),
        where('usernameLower', '==', username.toLowerCase()),
        where('tag', '==', tag)
      );
      const tagSnap = await getDocs(tagQuery);
      if (tagSnap.empty) return tag;
    }
    alert("Failed to generate unique tag. Try a new username?");
    return null;
  };

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
        const tag = await generateTag(username);
        if (!tag) {
          setError("Couldn't find a tag, try another username.");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          username,
          tag,
          usernameLower: username.toLowerCase(),
          email,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}${tag}`,
          createdAt: serverTimestamp(),
          lastUsernameChange: serverTimestamp(),
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
          {!isLogin && (
            <div className="input-group">
              <label>
                <span className="label-icon">👤</span>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="Choose a unique username"
                required={!isLogin}
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

function ChatPage({ user, setPage, profileLink }) {
  const [friends, setFriends] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [editingNicknameId, setEditingNicknameId] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [showEmojiBox, setShowEmojiBox] = useState({ id: null });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const friendsArr = Array.isArray(user?.friends) ? user.friends : [];
    if (!friendsArr.length) {
      setFriends([]);
      return;
    }
    const friendObjs = friendsArr.map(f => typeof f === 'string' ? { userId: f, nickname: "" } : f);
    const friendsData = [];
    const unsubscribes = [];
    friendObjs.forEach(({ userId, nickname }) => {
      const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) {
          const friendData = { uid: userId, ...docSnap.data(), nickname };
          const existingIndex = friendsData.findIndex(f => f.uid === userId);
          if (existingIndex >= 0) {
            friendsData[existingIndex] = friendData;
          } else {
            friendsData.push(friendData);
          }
          setFriends([...friendsData]);
        }
      });
      unsubscribes.push(unsub);
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user?.friends]);

  useEffect(() => {
    if (!selectedChat || !user) return;
    if (selectedChat.isGroup) {
      const groupId = selectedChat.id;
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(msgs);
      });
      return () => unsubscribe();
    } else {
      const chatId = [user.uid, selectedChat.uid].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(msgs);
      });
      return () => unsubscribe();
    }
  }, [selectedChat, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { online: true });
    const handleOffline = () => {
      updateDoc(userRef, { online: false, lastSeen: serverTimestamp() });
    };
    window.addEventListener('beforeunload', handleOffline);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        updateDoc(userRef, { online: false, lastSeen: serverTimestamp() });
      } else {
        updateDoc(userRef, { online: true });
      }
    });
    return () => {
      window.removeEventListener('beforeunload', handleOffline);
      handleOffline();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(query(collection(db, 'groups')), (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.members?.includes(user.uid)) {
          list.push({ ...data, id: docSnap.id, isGroup: true });
        }
      });
      setGroups(list);
    });
    return () => unsub();
  }, [user?.uid]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    if (selectedChat.isGroup) {
      const messagesRef = collection(db, 'groups', selectedChat.id, 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: user.uid,
        senderName: user.username,
        createdAt: serverTimestamp(),
        reactions: {}
      });
    } else {
      const chatId = [user.uid, selectedChat.uid].sort().join('_');
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: user.uid,
        senderName: user.username,
        createdAt: serverTimestamp(),
        reactions: {}
      });
    }
    setNewMessage('');
  };

  const handleLogout = async () => {
    if (user?.uid) {
      await updateDoc(doc(db, 'users', user.uid), { 
        online: false, 
        lastSeen: serverTimestamp() 
      });
    }
    await signOut(auth);
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const startEditingNickname = (friendId, currentNickname) => {
    setEditingNicknameId(friendId); 
    setNicknameInput(currentNickname || "");
  };

  const applyNickname = async (friendUid) => {
    const friendsArr = Array.isArray(user.friends) ? user.friends : [];
    const newFriends = friendsArr.map(f => {
      const obj = typeof f === 'string' ? { userId: f, nickname: "" } : f;
      if (obj.userId === friendUid) return { ...obj, nickname: nicknameInput };
      return obj;
    });
    await updateDoc(doc(db, 'users', user.uid), { friends: newFriends });
    setEditingNicknameId(null);
    setNicknameInput('');
  };

  const openGroupModal = () => {
    setShowGroupModal(true);
    setGroupName('');
    setGroupMembers([user.uid]);
  };

  const handleGroupMember = (uid) => {
    setGroupMembers((members) => 
      members.includes(uid) ? members.filter(m => m !== uid) : [...members, uid]
    );
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || groupMembers.length < 2) return;
    await addDoc(collection(db, "groups"), {
      name: groupName,
      members: groupMembers,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    setShowGroupModal(false);
  };

  const handleReact = async (msgId, emoji, reactionsObj) => {
    if (!selectedChat) return;
    let coll, chatDocId;
    if (selectedChat.isGroup) {
      coll = collection(db, 'groups', selectedChat.id, 'messages');
      chatDocId = selectedChat.id;
    } else {
      coll = collection(db, 'chats', [user.uid, selectedChat.uid].sort().join('_'), 'messages');
      chatDocId = [user.uid, selectedChat.uid].sort().join('_');
    }
    const msgDoc = doc(coll, msgId);
    const snapshot = await getDocs(query(coll, where("__name__", "==", msgId)));
    let messageObj = {};
    if (!snapshot.empty) {
      messageObj = snapshot.docs[0].data();
    }
    let currentReactions = messageObj.reactions || {};
    let updatedReactions = { ...currentReactions };

    if (currentReactions[emoji] && currentReactions[emoji].includes(user.uid)) {
      updatedReactions[emoji] = updatedReactions[emoji].filter(u => u !== user.uid);
      if (updatedReactions[emoji].length === 0) delete updatedReactions[emoji];
    } else {
      updatedReactions[emoji] = updatedReactions[emoji] ? [...updatedReactions[emoji], user.uid] : [user.uid];
    }
    await updateDoc(msgDoc, { reactions: updatedReactions });
  };

  const removeFriend = async (friendUid) => {
    const myFriends = Array.isArray(user.friends) ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
    await updateDoc(doc(db, 'users', user.uid), {
      friends: myFriends.filter(f => f.userId !== friendUid)
    });
    const friendDoc = doc(db, 'users', friendUid);
    const friendSnap = await getDocs(query(collection(db, 'users'), where("__name__", "==", friendUid)));
    if (!friendSnap.empty && friendSnap.docs[0].data().friends) {
      const theirFriends = friendSnap.docs[0].data().friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f);
      await updateDoc(friendDoc, {
        friends: theirFriends.filter(f => f.userId !== user.uid)
      });
    }
  };

  const deleteGroup = async (groupId) => {
    await deleteDoc(doc(db, 'groups', groupId));
    setSelectedChat(null);
  };

  const leaveGroup = async (groupId) => {
    const currentGroup = groups.find(g => g.id === groupId);
    if (!currentGroup) return;
    const newMembers = currentGroup.members.filter(uid => uid !== user.uid);
    await updateDoc(doc(db, 'groups', groupId), {
      members: newMembers
    });
    setSelectedChat(null);
  };

  const sidebarItems = [
    ...groups.map(g => ({
      ...g,
      label: g.name,
      isGroup: true
    })),
    ...friends.map(f => ({
      ...f,
      label: f.nickname || `${f.username}#${f.tag}`,
      isGroup: false
    }))
  ];

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
          <img src={user?.avatar} alt="" className="avatar" />
          <div className="user-details">
            <h3>{user?.username}#{user?.tag}</h3>
            <span className="status online">● Online</span>
          </div>
          <span className="profile-arrow">›</span>
        </div>
        <div className="sidebar-actions">
          <button className="btn-add-friend" onClick={() => setPage('addFriend')}>
            <span className="btn-add-icon">+</span>
            Add Friend
          </button>
          <button className="btn-add-friend" style={{marginTop:"5px"}} onClick={openGroupModal}>
            <span className="btn-add-icon">👥</span>
            New Group
          </button>
          <button
            className="btn-add-friend"
            style={{marginTop:"5px",background:"#fff",color:"#2563eb"}}
            onClick={() => window.navigator.clipboard.writeText(profileLink)}
            title="Copy your profile link"
          >
            <span className="btn-add-icon">🔗</span>
            Copy Profile Link
          </button>
        </div>
        <div className="friends-section">
          <h4>Chats <span className="friend-count">{sidebarItems.length}</span></h4>
          <div className="friends-list">
            {sidebarItems.length === 0 ? (
              <div className="no-friends">
                <span className="no-friends-icon">👥</span>
                <p>No chats or groups yet</p>
                <span className="no-friends-hint">Start a conversation!</span>
              </div>
            ) : (
              sidebarItems.map(item => (
                <div
                  key={item.isGroup ? `group-${item.id}` : item.uid}
                  className={`friend-item ${selectedChat && ((item.isGroup && selectedChat.id === item.id) || (!item.isGroup && selectedChat.uid === item.uid)) ? 'active' : ''}`}
                  onClick={() => setSelectedChat(item)}
                  style={item.isGroup ? {backgroundColor:"#3730a321"} : {}}
                >
                  <div className="friend-avatar-wrapper">
                    <img src={item.avatar || "/default-group.png"} alt="" className="avatar-sm" />
                    {item.isGroup 
                      ? <span className="status-dot" style={{background:"#818cf8"}}></span>
                      : <span className={`status-dot ${item.online ? 'online' : 'offline'}`}></span>
                    }
                  </div>
                  <div className="friend-info">
                    {item.isGroup ? (
                      <span style={{fontWeight:600,color:"#8b5cf6"}}>{item.label}</span>
                    ) : (
                      editingNicknameId === item.uid ? (
                        <div style={{display:'flex', alignItems:'center', marginBottom:"2px"}}>
                          <input
                            value={nicknameInput}
                            onChange={e => setNicknameInput(e.target.value)}
                            placeholder="Enter custom name"
                            style={{fontSize:"0.92em"}}
                          />
                          <button
                            style={{marginLeft:'2px', fontSize:'1em'}}
                            onClick={e => { e.stopPropagation(); applyNickname(item.uid); }}
                          >✔</button>
                          <button
                            style={{marginLeft:'2px', fontSize:'1em'}}
                            onClick={e => { e.stopPropagation(); setEditingNicknameId(null); }}
                          >✗</button>
                        </div>
                      ) : (
                        <>
                          {item.nickname &&
                            <span className="friend-nickname">{item.nickname}</span>
                          }
                          <span className="friend-name">{item.username}#{item.tag}</span>
                          <button
                            style={{
                              marginLeft:"5px",fontSize:"0.85em",background:"none",border:"none",
                              color:"#94a3b8",cursor:"pointer"
                            }}
                            title="Edit Nickname"
                            onClick={e => { e.stopPropagation(); startEditingNickname(item.uid, item.nickname); }}
                          >✏️</button>
                          <button
                            style={{
                              marginLeft:"4px",fontSize:"0.89em",background:"none",border:"none",
                              color:"#ef4444",cursor:"pointer"
                            }}
                            title="Remove Friend"
                            onClick={e => { e.stopPropagation(); removeFriend(item.uid); }}
                          >🗑️</button>
                        </>
                      )
                    )}
                    <span className={`friend-status ${item.isGroup ? "online" : (item.online ? 'online' : 'offline')}`}>
                      {item.isGroup
                        ? "Group"
                        : item.online ? 'Online' : 'Offline'}
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
        {selectedChat ? (
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
                  <img src={selectedChat.avatar || "/default-group.png"} alt="" className="avatar-sm" />
                  <span className={`status-dot ${selectedChat.isGroup ? "online" : (selectedChat.online ? 'online' : 'offline')}`}></span>
                </div>
                <div>
                  {selectedChat.isGroup ? (
                    <div style={{fontSize:"1.1em",fontWeight:700,color:"#8b5cf6"}}>{selectedChat.name}</div>
                  ) : (
                    <>
                      {selectedChat.nickname && <div className="friend-nickname">{selectedChat.nickname}</div>}
                      <h3>{selectedChat.username}#{selectedChat.tag}</h3>
                    </>
                  )}
                  <span className={`header-status ${selectedChat.isGroup ? "online" : (selectedChat.online ? 'online' : 'offline')}`}>
                    {selectedChat.isGroup ? '• Group' : selectedChat.online ? '● Online' : '○ Offline'}
                  </span>
                  {selectedChat.isGroup && (
                    <div style={{marginTop:"10px"}}>
                      {selectedChat.createdBy === user.uid ? (
                        <button className="btn-primary" style={{marginRight:"7px",background:"#ef4444"}} onClick={()=>deleteGroup(selectedChat.id)}>Delete Group</button>
                      ) : (
                        <button className="btn-primary" style={{background:"#2563eb"}} onClick={()=>leaveGroup(selectedChat.id)}>Leave Group</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <span className="wave-emoji">👋</span>
                  <p>
                    Say hello to{" "}
                    {selectedChat.isGroup
                      ? selectedChat.name
                      : selectedChat.nickname
                        ? `${selectedChat.nickname} (${selectedChat.username}#${selectedChat.tag})`
                        : `${selectedChat.username}#${selectedChat.tag}`}
                    !
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const reactions = msg.reactions || {};
                  return (
                    <div
                      key={msg.id}
                      className={`message ${msg.senderId === user.uid ? 'sent' : 'received'}`}
                    >
                      <div className="message-bubble" style={{position:'relative'}}>
                        <p>{msg.text}</p>
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                        {selectedChat.isGroup &&
                          <span style={{
                            fontSize:"0.8em",
                            color:"#64748b",
                            marginLeft:"7px"
                          }}>{msg.senderName}{msg.senderId === user.uid && " (You)"}</span>
                        }
                        <div style={{display:"flex", gap:"5px", marginTop:4}}>
                          {Object.keys(reactions).map(e => reactions[e]?.length ? (
                            <span
                              key={e}
                              style={{
                                background:"#e0e7ff",
                                color:"#3730a3",
                                borderRadius:"14px",
                                padding:"2px 6px",
                                fontSize:"1.02em",
                                cursor:"pointer"
                              }}
                              onClick={() => handleReact(msg.id, e, reactions)}
                              title={reactions[e].includes(user.uid) ? "Remove reaction" : "React"}
                            >
                              {e} {reactions[e].length}
                            </span>
                          ) : null)}
                          <button
                            onClick={() => setShowEmojiBox({ id: msg.id })}
                            style={{
                              fontSize:"1.06em",
                              background:"none",
                              border:"none",
                              cursor:"pointer",
                              color:"#a5b4fc"
                            }}
                          >😊</button>
                        </div>
                        {showEmojiBox.id === msg.id && (
                          <div
                            style={{
                              position:"absolute",
                              left:"0",top:"-45px",
                              background:"#fff",
                              border:"1px solid #ddd",
                              borderRadius:"8px",
                              padding:"3px 7px",
                              display:"flex",
                              gap:"6px",
                              zIndex:11
                            }}
                          >
                            {EMOJIS.map(e=>
                              <span
                                key={e}
                                style={{
                                  fontSize:"1.25em",
                                  cursor:"pointer",
                                  padding:"0 2px"
                                }}
                                onClick={()=>{
                                  handleReact(msg.id, e, reactions);
                                  setShowEmojiBox({id: null});
                                }}
                              >{e}</span>
                            )}
                            <span style={{cursor:"pointer",color:"#64748b"}} onClick={()=>setShowEmojiBox({id: null})}>×</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="message-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={selectedChat.isGroup ? "Message group..." : "Type a message..."}
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
              <p>Select a chat or group to start messaging</p>
            </div>
          </div>
        )}
      </div>
      {showGroupModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            backgroundColor: "rgba(20, 22, 45, 0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <form
            style={{
              background: "#1c1e2d",
              borderRadius: 14,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              minWidth: 300,
              boxShadow: "0px 6px 32px #0002"
            }}
            onSubmit={createGroup}
          >
            <strong style={{ fontSize: "1.4em", marginBottom: 12 }}>Create Group</strong>
            <label>Group Name</label>
            <input
              style={{
                padding: 6,
                fontSize: "1em",
                margin: "4px 0 12px 0",
                borderRadius: 6,
                border: "1px solid #64748b"
              }}
              type="text"
              value={groupName}
              maxLength={32}
              onChange={e => setGroupName(e.target.value)}
              required
            />
            <label style={{ marginBottom: 4 }}>Add Friends</label>
            <div style={{
              maxHeight: 120,
              overflowY: "auto",
              background: "#22242c",
              borderRadius: 6,
              marginBottom: 10
            }}>
              {friends
                .filter(f => f.uid !== user.uid)
                .map(f => (
                  <div key={f.uid} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={groupMembers.includes(f.uid)}
                      onChange={() => handleGroupMember(f.uid)}
                      id={`memberbox${f.uid}`}
                    />
                    <label htmlFor={`memberbox${f.uid}`} style={{ marginLeft: 7, cursor: "pointer" }}>
                      {f.nickname ? f.nickname + " " : ""}
                      {f.username}#{f.tag}
                    </label>
                  </div>
                ))}
            </div>
            <button
              className="btn-primary"
              style={{margin:"10px 0 5px 0"}}
              type="submit"
              disabled={!groupName.trim() || groupMembers.length < 2}
            >
              Create
            </button>
            <button
              style={{
                background: "none",
                color: "#fca5a5",
                border: "none",
                margin: "0 auto",
                fontWeight: 600,
                cursor: "pointer"
              }}
              type="button"
              onClick={() => setShowGroupModal(false)}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AddFriendPage({ user, setPage }) {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uparam = params.get("u");
    const tparam = params.get("t");
    if (uparam && tparam) {
      setSearchUsername(uparam);
      setSearchTag(tparam);
    }
  }, []);

  const searchUser = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setSearchResult(null);
    setSearching(true);

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('usernameLower', '==', searchUsername.toLowerCase().trim()),
        where('tag', '==', searchTag.toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('User not found. Check the username+tag and try again.');
      } else {
        const foundUser = { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        const myFriends = Array.isArray(user.friends) ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
        if (foundUser.uid === user.uid) {
          setError("That's you! Try searching for someone else.");
        } else if (myFriends.some(f => f.userId === foundUser.uid)) {
          setError(`${foundUser.username}#${foundUser.tag} is already in your circle!`);
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
      const myFriends = Array.isArray(user.friends) ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
      await updateDoc(doc(db, 'users', user.uid), {
        friends: [...myFriends, { userId: searchResult.uid, nickname: "" }]
      });
      const theirFriends = Array.isArray(searchResult.friends) ? searchResult.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
      await updateDoc(doc(db, 'users', searchResult.uid), {
        friends: [...theirFriends, { userId: user.uid, nickname: "" }]
      });
      setSuccess(`${searchResult.username}#${searchResult.tag} added to your circle! 🎉`);
      setSearchResult(null);
      setSearchUsername('');
      setSearchTag('');
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
          <p>Search by username and tag to add friends</p>
        </div>
        <form onSubmit={searchUser} className="search-form">
          <div className="input-group">
            <input
              type="text"
              value={searchUsername}
              onChange={e => setSearchUsername(e.target.value.replace(/\s/g, ''))}
              placeholder="Username"
              required
            />
            <input
              type="text"
              value={searchTag}
              onChange={e => setSearchTag(e.target.value.toUpperCase())}
              placeholder="Tag (e.g. X1P5)"
              required
              maxLength={4}
              style={{ width: "90px", textTransform: "uppercase" }}
            />
            <button type="submit" className="btn-primary" disabled={searching || !searchUsername.trim() || !searchTag.trim()}>
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
                <h3>{searchResult.username}#{searchResult.tag}</h3>
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
          <p>Ask your friend for their exact username and tag, or use their shareable profile link</p>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setPage, profileLink }) {
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const lastChanged = user?.lastUsernameChange?.toDate?.() || null;
  const canChangeUsername = (() => {
    if (!lastChanged) return true;
    const now = new Date();
    const days = (now - lastChanged) / (1000 * 60 * 60 * 24);
    return days >= 7;
  })();

  const formatDate = (timestamp) => {
    if (!timestamp?.toLocaleDateString) return 'Unknown';
    return timestamp.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    if (usernameInput.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }
    if (!canChangeUsername) {
      setError('You can only change username once every 7 days.');
      setLoading(false);
      return;
    }
    const q = query(collection(db, "users"), where("usernameLower", "==", usernameInput.toLowerCase()), where("tag", "==", user.tag));
    const snap = await getDocs(q);
    if (!snap.empty && snap.docs[0].id !== user.uid) {
      setError("Username already taken with current tag.");
      setLoading(false);
      return;
    }
    await updateDoc(doc(db, "users", user.uid), {
      username: usernameInput,
      usernameLower: usernameInput.toLowerCase(),
      lastUsernameChange: serverTimestamp()
    });
    setSuccess("Username updated!");
    setLoading(false);
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
            <img src={user?.avatar} alt="" className="profile-avatar" />
            <span className="profile-status-dot online"></span>
          </div>
          <form onSubmit={handleChangeUsername} style={{margin:"10px 0"}}>
            <input
              type="text"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
              disabled={!canChangeUsername || loading}
              style={{
                textAlign: "center",
                fontSize: "1.2rem",
                margin: "8px 0",
                fontWeight: 600,
                background: "#1118",
                color: "#fff",
                border: "none",
                borderBottom: "2px solid #64748b",
                outline: "none",
                borderRadius: 8,
                width: "140px",
              }}
            />
            <span style={{ fontWeight: 600 }}>#{user.tag}</span>
            <button className="btn-primary" style={{margin:'8px 0'}} disabled={!canChangeUsername || loading}>
              Change Username
            </button>
            {!canChangeUsername && (
              <div style={{color: "#fca5a5", fontSize:"0.92em"}}>
                Next change allowed after: {formatDate(lastChanged ? new Date(lastChanged.getTime() + 7*24*3600*1000) : null)}
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {success && <div className="message-box success">{success}</div>}
          </form>
          <p className="profile-email">{user?.email}</p>
          <button
            className="btn-primary"
            style={{marginTop:"10px",background:"#fff",color:"#2563eb"}}
            onClick={() => window.navigator.clipboard.writeText(profileLink)}
            title="Copy your shareable MYCircle profile link"
          >
            <span style={{marginRight:"5px"}}>🔗</span> Copy Your Profile Link
          </button>
          <div style={{color:"#64748b",fontSize:"0.97em",marginTop:"5px"}}>{profileLink}</div>
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
              <span className="info-value">{formatDate(user?.createdAt?.toDate?.())}</span>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">🆔</span>
            <div>
              <span className="info-label">Username</span>
              <span className="info-value">@{user?.username}#{user?.tag}</span>
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