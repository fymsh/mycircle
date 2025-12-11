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
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import './App.css';

const EMOJIS = ["❤️", "😂", "😮", "😢", "👏", "🔥", "👍", "🎉"];

function generateTagStr() {
  return Array.from({ length: 4 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
  ).join('');
}

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('auth');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(userRef, async (docu) => {
          if (docu.exists()) {
            let d = docu.data();
            if (!d.tag) {
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
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading Nexus</div>
        <div className="loading-subtext">Connecting to your circle...</div>
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
          friends: [],
          unread: {}
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
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
      </div>
      
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <div className="logo-inner">
                <div className="logo-dot dot-1"></div>
                <div className="logo-dot dot-2"></div>
                <div className="logo-dot dot-3"></div>
                <div className="logo-dot dot-4"></div>
              </div>
            </div>
            <h1 className="logo-title">Nexus</h1>
            <p className="logo-subtitle">Connect with your circle</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-field">
              <div className="input-icon">👤</div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="Username"
                required={!isLogin}
                maxLength={20}
                className="input-element"
              />
            </div>
          )}
          
          <div className="input-field">
            <div className="input-icon">✉️</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="input-element"
            />
          </div>
          
          <div className="input-field">
            <div className="input-icon">🔒</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="input-element"
            />
          </div>

          {error && <div className="error-alert">{error}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <div className="button-loader"></div>
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <span className="button-arrow">→</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <div className="toggle-mode">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              className="toggle-button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>

      <div className="auth-watermark">
        <div className="watermark-line"></div>
        <span>Designed with purpose</span>
        <div className="watermark-line"></div>
      </div>
    </div>
  );
}

function ChatPage({ user, setPage }) {
  const [friends, setFriends] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [emojiPicker, setEmojiPicker] = useState({ id: null });
  const [unreadMap, setUnreadMap] = useState({});
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
      updateDoc(doc(db, 'users', user.uid), { [`unread.group_${groupId}`]: 0 });
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
      updateDoc(doc(db, 'users', user.uid), { [`unread.chat_${selectedChat.uid}`]: 0 });
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

  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUnreadMap(docSnap.data().unread || {});
      }
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
      const groupId = selectedChat.id;
      groups.find(g => g.id === groupId)?.members?.forEach(async memberId => {
        if (memberId !== user.uid) {
          const memberRef = doc(db, 'users', memberId);
          const memberSnap = await getDoc(memberRef);
          const unreadCurr = memberSnap.data()?.unread?.[`group_${groupId}`] || 0;
          await updateDoc(memberRef, { [`unread.group_${groupId}`]: unreadCurr + 1 });
        }
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
      const receiverUid = selectedChat.uid;
      if (receiverUid !== user.uid) {
        const receiverRef = doc(db, 'users', receiverUid);
        const receiverSnap = await getDoc(receiverRef);
        const unreadCurr = receiverSnap.data()?.unread?.[`chat_${user.uid}`] || 0;
        await updateDoc(receiverRef, { [`unread.chat_${user.uid}`]: unreadCurr + 1 });
      }
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

  const updateNickname = async (friendUid) => {
    const friendsArr = Array.isArray(user.friends) ? user.friends : [];
    const newFriends = friendsArr.map(f => {
      const obj = typeof f === 'string' ? { userId: f, nickname: "" } : f;
      if (obj.userId === friendUid) return { ...obj, nickname: nicknameInput };
      return obj;
    });
    await updateDoc(doc(db, 'users', user.uid), { friends: newFriends });
    setEditingNickname(null);
    setNicknameInput('');
  };

  const openGroupModal = () => {
    setShowGroupModal(true);
    setGroupName('');
    setGroupMembers([user.uid]);
  };

  const toggleGroupMember = (uid) => {
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
    <div className="chat-app">
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="app-brand">
            <div className="brand-icon">
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
            </div>
            <h2>Nexus</h2>
          </div>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <div className="user-profile-card" onClick={() => setPage('profile')}>
          <img src={user?.avatar} alt="" className="profile-avatar" />
          <div className="profile-info">
            <h3>{user?.username}</h3>
            <p className="user-tag">#{user?.tag}</p>
            <span className="online-badge">● Online</span>
          </div>
          <div className="profile-chevron">›</div>
        </div>

        <div className="sidebar-actions">
          <button className="action-button" onClick={() => setPage('addFriend')}>
            <span className="action-icon">+</span>
            Add Friend
          </button>
          <button className="action-button secondary" onClick={openGroupModal}>
            <span className="action-icon">👥</span>
            New Group
          </button>
        </div>

        <div className="chats-section">
          <div className="section-header">
            <h3>My Circles</h3>
            <span className="badge">{sidebarItems.length}</span>
          </div>
          
          <div className="chats-list">
            {sidebarItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <p>No conversations yet</p>
                <small>Start by adding friends or creating a group</small>
              </div>
            ) : (
              sidebarItems.map(item => {
                let unreadCount = 0;
                if (item.isGroup) unreadCount = unreadMap[`group_${item.id}`] || 0;
                else unreadCount = unreadMap[`chat_${item.uid}`] || 0;
                
                return (
                  <div
                    key={item.isGroup ? `group-${item.id}` : item.uid}
                    className={`chat-item ${selectedChat && ((item.isGroup && selectedChat.id === item.id) || (!item.isGroup && selectedChat.uid === item.uid)) ? 'active' : ''}`}
                    onClick={() => setSelectedChat(item)}
                  >
                    <div className="chat-avatar">
                      <img src={item.avatar || "/default-group.png"} alt="" />
                      {item.isGroup ? (
                        <div className="status-indicator group"></div>
                      ) : (
                        <div className={`status-indicator ${item.online ? 'online' : 'offline'}`}></div>
                      )}
                      {unreadCount > 0 && (
                        <div className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>
                      )}
                    </div>
                    
                    <div className="chat-details">
                      {item.isGroup ? (
                        <div className="group-info">
                          <h4>{item.label}</h4>
                          <p className="group-label">Group</p>
                        </div>
                      ) : (
                        <>
                          {editingNickname === item.uid ? (
                            <div className="nickname-edit">
                              <input
                                value={nicknameInput}
                                onChange={e => setNicknameInput(e.target.value)}
                                placeholder="Custom name"
                                autoFocus
                              />
                              <button onClick={() => updateNickname(item.uid)}>✓</button>
                              <button onClick={() => setEditingNickname(null)}>✕</button>
                            </div>
                          ) : (
                            <div className="friend-info">
                              {item.nickname && <span className="nickname">{item.nickname}</span>}
                              <h4>{item.username}#{item.tag}</h4>
                              <div className="friend-actions">
                                <button onClick={(e) => { e.stopPropagation(); setEditingNickname(item.uid); setNicknameInput(item.nickname || ""); }}>✏️</button>
                                <button onClick={(e) => { e.stopPropagation(); removeFriend(item.uid); }}>🗑️</button>
                              </div>
                            </div>
                          )}
                          <p className="status-text">{item.online ? 'Online' : 'Offline'}</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout}>
            <span className="logout-icon">🚪</span>
            Logout
          </button>
        </div>
      </div>

      <div className="chat-main">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                ☰
              </button>
              
              <div className="chat-info">
                <div className="current-chat-avatar">
                  <img src={selectedChat.avatar || "/default-group.png"} alt="" />
                  <div className={`current-status ${selectedChat.isGroup ? 'group' : (selectedChat.online ? 'online' : 'offline')}`}></div>
                </div>
                
                <div className="chat-meta">
                  {selectedChat.isGroup ? (
                    <>
                      <h2>{selectedChat.name}</h2>
                      <p>Group • {selectedChat.members?.length || 0} members</p>
                    </>
                  ) : (
                    <>
                      {selectedChat.nickname && <span className="current-nickname">{selectedChat.nickname}</span>}
                      <h2>{selectedChat.username}#{selectedChat.tag}</h2>
                      <p>{selectedChat.online ? '● Online' : '○ Last seen recently'}</p>
                    </>
                  )}
                </div>
                
                {selectedChat.isGroup && (
                  <div className="group-actions">
                    {selectedChat.createdBy === user.uid ? (
                      <button className="danger-button" onClick={() => deleteGroup(selectedChat.id)}>Delete</button>
                    ) : (
                      <button className="secondary-button" onClick={() => leaveGroup(selectedChat.id)}>Leave</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="messages-area">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">👋</div>
                  <h3>Start the conversation</h3>
                  <p>Say hello to {selectedChat.isGroup ? selectedChat.name : selectedChat.username}!</p>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map(msg => {
                    const reactions = msg.reactions || {};
                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble ${msg.senderId === user.uid ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          {selectedChat.isGroup && msg.senderId !== user.uid && (
                            <div className="sender-name">{msg.senderName}</div>
                          )}
                          <div className="message-text">{msg.text}</div>
                          <div className="message-footer">
                            <span className="message-time">{formatTime(msg.createdAt)}</span>
                            {Object.keys(reactions).length > 0 && (
                              <div className="reactions-bar">
                                {Object.entries(reactions).map(([emoji, users]) => (
                                  users.length > 0 && (
                                    <span
                                      key={emoji}
                                      className={`reaction ${users.includes(user.uid) ? 'active' : ''}`}
                                      onClick={() => handleReact(msg.id, emoji, reactions)}
                                    >
                                      {emoji} {users.length}
                                    </span>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="message-actions">
                          <button className="react-button" onClick={() => setEmojiPicker({ id: msg.id })}>😊</button>
                          {emojiPicker.id === msg.id && (
                            <div className="emoji-picker">
                              {EMOJIS.map(emoji => (
                                <span
                                  key={emoji}
                                  onClick={() => {
                                    handleReact(msg.id, emoji, reactions);
                                    setEmojiPicker({ id: null });
                                  }}
                                >
                                  {emoji}
                                </span>
                              ))}
                              <button onClick={() => setEmojiPicker({ id: null })}>✕</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form className="message-input-area" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={selectedChat.isGroup ? "Message group..." : "Type a message..."}
                autoComplete="off"
                className="message-input"
              />
              <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                <svg viewBox="0 0 24 24" className="send-icon">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <div className="welcome-screen">
              <div className="welcome-icon">
                <div className="welcome-dot"></div>
                <div className="welcome-dot"></div>
                <div className="welcome-dot"></div>
                <div className="welcome-dot"></div>
              </div>
              <h1>Welcome to MYCircle</h1>
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Group</h2>
              <button onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            
            <form onSubmit={createGroup}>
              <div className="modal-input">
                <label>Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  maxLength={32}
                  required
                />
              </div>
              
              <div className="modal-input">
                <label>Add Members</label>
                <div className="members-selector">
                  {friends
                    .filter(f => f.uid !== user.uid)
                    .map(f => (
                      <div key={f.uid} className="member-option">
                        <input
                          type="checkbox"
                          checked={groupMembers.includes(f.uid)}
                          onChange={() => toggleGroupMember(f.uid)}
                          id={`member-${f.uid}`}
                        />
                        <label htmlFor={`member-${f.uid}`}>
                          <img src={f.avatar} alt="" className="member-avatar" />
                          <span>{f.nickname ? f.nickname : `${f.username}#${f.tag}`}</span>
                        </label>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="primary-button" disabled={!groupName.trim() || groupMembers.length < 2}>
                  Create Group
                </button>
                <button type="button" className="secondary-button" onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
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
        setError('User not found. Check the username and tag combination.');
      } else {
        const foundUser = { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        const myFriends = Array.isArray(user.friends) ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
        if (foundUser.uid === user.uid) {
          setError("You can't add yourself!");
        } else if (myFriends.some(f => f.userId === foundUser.uid)) {
          setError("Already friends!");
        } else {
          setSearchResult(foundUser);
        }
      }
    } catch (err) {
      setError('Search failed. Please try again.');
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
      setSuccess("Friend added successfully!");
      setSearchResult(null);
      setSearchUsername('');
      setSearchTag('');
      setTimeout(() => setPage('chat'), 1500);
    } catch (err) {
      setError('Failed to add friend.');
    }
    setLoading(false);
  };

  return (
    <div className="add-friend-page">
      <div className="page-header">
        <button className="back-button" onClick={() => setPage('chat')}>
          ← Back
        </button>
        <h1>Add Friend</h1>
      </div>

      <div className="search-section">
        <div className="search-card">
          <h2>Find Friends</h2>
          <p>Search by username and tag</p>
          
          <form onSubmit={searchUser} className="search-form">
            <div className="search-inputs">
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
                placeholder="TAG"
                required
                maxLength={4}
                className="tag-input"
              />
              <button type="submit" className="search-button" disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          {searchResult && (
            <div className="result-card">
              <div className="result-header">
                <img src={searchResult.avatar} alt="" className="result-avatar" />
                <div className="result-info">
                  <h3>{searchResult.username}</h3>
                  <p className="result-tag">#{searchResult.tag}</p>
                  <span className={`status ${searchResult.online ? 'online' : 'offline'}`}>
                    {searchResult.online ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>
              <button 
                className="add-button"
                onClick={addFriend}
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Friend'}
              </button>
            </div>
          )}

          <div className="search-tip">
            <span>💡</span>
            <p>Ask your friend for their exact username and 4-digit tag</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setPage }) {
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
    <div className="profile-page">
      <div className="page-header">
        <button className="back-button" onClick={() => setPage('chat')}>
          ← Back
        </button>
        <h1>Profile</h1>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-header">
            <div className="avatar-container">
              <img src={user?.avatar} alt="" className="profile-avatar-large" />
              <div className="online-status">●</div>
            </div>
            
            <form onSubmit={handleChangeUsername} className="username-form">
              <div className="username-display">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value.replace(/\s/g, ""))}
                  maxLength={20}
                  disabled={!canChangeUsername || loading}
                  className="username-input"
                />
                <span className="user-tag-large">#{user.tag}</span>
              </div>
              
              <button type="submit" className="update-button" disabled={!canChangeUsername || loading}>
                {loading ? 'Updating...' : 'Update Username'}
              </button>
              
              {!canChangeUsername && (
                <p className="cooldown-notice">
                  Next change available in {Math.ceil(7 - ((new Date() - lastChanged) / (1000 * 60 * 60 * 24)))} days
                </p>
              )}
              
              {error && <div className="alert error">{error}</div>}
              {success && <div className="alert success">{success}</div>}
            </form>
          </div>

          <div className="profile-stats-grid">
            <div className="stat-item">
              <div className="stat-number">{user?.friends?.length || 0}</div>
              <div className="stat-label">Friends</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">●</div>
              <div className="stat-label">Status</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {new Date(user?.createdAt?.toDate?.()).getFullYear()}
              </div>
              <div className="stat-label">Joined</div>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-item">
              <span className="detail-icon">✉️</span>
              <div className="detail-content">
                <div className="detail-label">Email</div>
                <div className="detail-value">{user?.email}</div>
              </div>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon">📅</span>
              <div className="detail-content">
                <div className="detail-label">Member Since</div>
                <div className="detail-value">{formatDate(user?.createdAt?.toDate?.())}</div>
              </div>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon">🆔</span>
              <div className="detail-content">
                <div className="detail-label">User ID</div>
                <div className="detail-value">{user?.uid?.substring(0, 8)}...</div>
              </div>
            </div>
          </div>

          <div className="profile-footer">
            <p className="app-credit">MYCircle • The circle that matters.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;