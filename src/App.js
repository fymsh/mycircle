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
const BANNER_COLORS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
];

const CARD_COLORS = [
  'var(--bg-card)',
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#1e1e2e',
  '#1a1b26',
  '#1c1c2e'
];

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
        let unsubUser;
        unsubUser = onSnapshot(userRef, async (docu) => {
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
        setLoading(false);
        return () => unsubUser && unsubUser();
      } else {
        setUser(null);
        setUserData(null);
        setPage('auth');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading</div>
        <div className="loading-subtext">Connecting to your circle...</div>
      </div>
    );
  }

  return (
    <div className="app">
      {page === 'auth' && <AuthPage setPage={setPage} />}
      {page === 'chat' && userData && <ChatPage user={userData} setPage={setPage} />}
      {page === 'addFriend' && userData && <AddFriendPage user={userData} setPage={setPage} />}
      {page === 'profile' && userData && <ProfilePage user={userData} setPage={setPage} isOwnProfile={true} />}
      {page.startsWith('viewProfile-') && userData && (
        <ViewProfilePage 
          user={userData} 
          setPage={setPage} 
          profileId={page.split('-')[1]}
        />
      )}
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
          bio: '',
          bannerColor: BANNER_COLORS[0],
          cardColor: CARD_COLORS[0],
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
            <h1 className="logo-title">MYCircle</h1>
            <p className="logo-subtitle">The circle that matters</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-field">
              <span className="input-icon">👤</span>
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
            <span className="input-icon">✉️</span>
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
            <span className="input-icon">🔒</span>
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
        <span>MYCircle v1.0</span>
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
  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [emojiPicker, setEmojiPicker] = useState({ id: null });
  const [unreadMap, setUnreadMap] = useState({});
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState(null);
  const [newMembers, setNewMembers] = useState([]);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [sidebarItems, setSidebarItems] = useState([]);
  const [chatLastMessages, setChatLastMessages] = useState({});
  const [messageSeenBy, setMessageSeenBy] = useState({});
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
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          setChatLastMessages(prev => ({
            ...prev,
            [`group_${groupId}`]: {
              text: lastMsg.text,
              timestamp: lastMsg.createdAt,
              senderId: lastMsg.senderId
            }
          }));
          
          const lastMessageId = msgs[msgs.length - 1].id;
          const seenRef = collection(db, 'groups', groupId, 'messages', lastMessageId, 'seenBy');
          const seenUnsub = onSnapshot(seenRef, (seenSnap) => {
            const seenData = {};
            seenSnap.forEach(doc => {
              seenData[doc.id] = doc.data();
            });
            setMessageSeenBy(prev => ({
              ...prev,
              [lastMessageId]: seenData
            }));
          });
          return () => seenUnsub();
        }
      });
      updateDoc(doc(db, 'users', user.uid), { [`unread.group_${groupId}`]: 0 });
      
      const markAsSeen = async () => {
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.senderId !== user.uid) {
            const seenRef = doc(db, 'groups', groupId, 'messages', lastMsg.id, 'seenBy', user.uid);
            await setDoc(seenRef, {
              username: user.username,
              seenAt: serverTimestamp()
            }, { merge: true });
          }
        }
      };
      markAsSeen();
      
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
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          setChatLastMessages(prev => ({
            ...prev,
            [`chat_${selectedChat.uid}`]: {
              text: lastMsg.text,
              timestamp: lastMsg.createdAt,
              senderId: lastMsg.senderId
            }
          }));
          
          const lastMessageId = msgs[msgs.length - 1].id;
          const seenRef = doc(db, 'chats', chatId, 'messages', lastMessageId);
          const seenUnsub = onSnapshot(seenRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setMessageSeenBy(prev => ({
                ...prev,
                [lastMessageId]: data.seenBy || []
              }));
            }
          });
          return () => seenUnsub();
        }
      });
      updateDoc(doc(db, 'users', user.uid), { [`unread.chat_${selectedChat.uid}`]: 0 });
      
      const markAsSeen = async () => {
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.senderId !== user.uid) {
            const msgRef = doc(db, 'chats', chatId, 'messages', lastMsg.id);
            await updateDoc(msgRef, {
              seenBy: [...(lastMsg.seenBy || []), user.uid]
            });
          }
        }
      };
      markAsSeen();
      
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

  useEffect(() => {
    const combinedItems = [
      ...groups.map(g => ({
        ...g,
        label: g.name,
        isGroup: true,
        lastMessage: chatLastMessages[`group_${g.id}`]
      })),
      ...friends.map(f => ({
        ...f,
        label: f.nickname || `${f.username}#${f.tag}`,
        isGroup: false,
        lastMessage: chatLastMessages[`chat_${f.uid}`]
      }))
    ];
    
    const sortedItems = [...combinedItems].sort((a, b) => {
      const timeA = a.lastMessage?.timestamp?.toDate?.() || new Date(0);
      const timeB = b.lastMessage?.timestamp?.toDate?.() || new Date(0);
      return timeB - timeA;
    });
    
    setSidebarItems(sortedItems);
  }, [friends, groups, chatLastMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
    
    const messageData = {
      text: newMessage,
      senderId: user.uid,
      senderName: user.username,
      createdAt: serverTimestamp(),
      reactions: {}
    };
    
    if (replyingTo) {
      messageData.replyTo = {
        messageId: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName
      };
    }
    
    if (selectedChat.isGroup) {
      const messagesRef = collection(db, 'groups', selectedChat.id, 'messages');
      await addDoc(messagesRef, messageData);
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
      await addDoc(messagesRef, messageData);
      const receiverUid = selectedChat.uid;
      if (receiverUid !== user.uid) {
        const receiverRef = doc(db, 'users', receiverUid);
        const receiverSnap = await getDoc(receiverRef);
        const unreadCurr = receiverSnap.data()?.unread?.[`chat_${user.uid}`] || 0;
        await updateDoc(receiverRef, { [`unread.chat_${user.uid}`]: unreadCurr + 1 });
      }
    }
    setNewMessage('');
    setReplyingTo(null);
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

  const formatDateShort = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
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

  const openAddMembersModal = (groupId) => {
    setSelectedGroupForMembers(groupId);
    setNewMembers([]);
    setShowAddMembersModal(true);
  };

  const toggleNewMember = (uid) => {
    setNewMembers((members) => 
      members.includes(uid) ? members.filter(m => m !== uid) : [...members, uid]
    );
  };

  const addMembersToGroup = async () => {
    if (!selectedGroupForMembers || newMembers.length === 0) return;
    const groupRef = doc(db, 'groups', selectedGroupForMembers);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const currentMembers = groupSnap.data().members || [];
      const updatedMembers = [...currentMembers, ...newMembers.filter(uid => !currentMembers.includes(uid))];
      await updateDoc(groupRef, { members: updatedMembers });
    }
    setShowAddMembersModal(false);
    setSelectedGroupForMembers(null);
    setNewMembers([]);
  };

  const viewGroupMembers = async (groupId) => {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const members = groupSnap.data().members || [];
      const membersData = [];
      for (const memberId of members) {
        const userRef = doc(db, 'users', memberId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          membersData.push({ uid: memberId, ...userSnap.data() });
        }
      }
      setSelectedGroupMembers(membersData);
      setShowGroupMembersModal(true);
    }
  };

  const getSeenStatus = (message) => {
    if (!message || message.senderId !== user.uid) return null;
    
    if (selectedChat.isGroup) {
      const seenData = messageSeenBy[message.id] || {};
      const seenUsers = Object.keys(seenData);
      if (seenUsers.length === 0) return null;
      return `Seen by ${seenUsers.length} member${seenUsers.length > 1 ? 's' : ''}`;
    } else {
      const seenBy = message.seenBy || [];
      if (seenBy.includes(selectedChat.uid)) {
        return 'Seen';
      }
      return null;
    }
  };

  const getGroupSeenUsers = (message) => {
    if (!message || !selectedChat.isGroup) return [];
    const seenData = messageSeenBy[message.id] || {};
    return Object.entries(seenData).map(([userId, data]) => ({
      userId,
      username: data.username
    }));
  };

  return (
    <div className="chat-app">
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
        <div className="sidebar-header">
          <div className="app-brand">
            <div className="brand-icon">
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
              <div className="brand-dot"></div>
            </div>
            <h2>MYCircle</h2>
          </div>
        </div>
        <div className="user-profile-card" onClick={() => setPage('profile')}>
          <img src={user?.avatar} alt="" className="profile-avatar" />
          <div className="profile-info">
            <h3>{user?.username}#{user?.tag}</h3>
            <div className="online-badge">● Online</div>
          </div>
          <div className="profile-chevron">›</div>
        </div>
        <div className="sidebar-actions">
          <button className="action-button" onClick={() => setPage('addFriend')}>
            <span className="action-icon">👤</span>
            Add Friend
          </button>
          <button className="action-button secondary" onClick={openGroupModal}>
            <span className="action-icon">👥</span>
            New Group
          </button>
        </div>
        <div className="chats-section">
          <div className="section-header">
            <h3>Recent Chats</h3>
            <span className="badge">{sidebarItems.length}</span>
          </div>
          <div className="chats-list">
            {sidebarItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <p>No conversations yet</p>
                <small>Add friends or create a group to start chatting</small>
              </div>
            ) : (
              sidebarItems.map(item => {
                let unreadCount = 0;
                if (item.isGroup) unreadCount = unreadMap[`group_${item.id}`] || 0;
                else unreadCount = unreadMap[`chat_${item.uid}`] || 0;
                
                const lastMsg = item.lastMessage?.text || 'No messages yet';
                const lastMsgTime = item.lastMessage?.timestamp ? formatDateShort(item.lastMessage.timestamp) : '';
                const isSender = item.lastMessage?.senderId === user.uid;
                const displayText = lastMsg.length > 25 ? lastMsg.substring(0, 25) + '...' : lastMsg;
                
                return (
                  <div
                    key={item.isGroup ? `group-${item.id}` : item.uid}
                    className={`chat-item ${selectedChat && ((item.isGroup && selectedChat.id === item.id) || (!item.isGroup && selectedChat.uid === item.uid)) ? 'active' : ''}`}
                    onClick={() => setSelectedChat(item)}
                  >
                    <div className="chat-avatar">
                      {item.isGroup ? (
                        <>
                          <div className="group-avatar-emoji">👥</div>
                          <div className="status-indicator group"></div>
                        </>
                      ) : (
                        <>
                          <img src={item.avatar} alt="" />
                          <div className={`status-indicator ${item.online ? 'online' : 'offline'}`}></div>
                        </>
                      )}
                      {unreadCount > 0 && (
                        <div className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>
                      )}
                    </div>
                    <div className="chat-details">
                      {item.isGroup ? (
                        <div className="group-info">
                          <h4>{item.label}</h4>
                          <p className="last-message">
                            {isSender ? 'You: ' : ''}{displayText}
                          </p>
                          <p className="last-message-time">{lastMsgTime}</p>
                        </div>
                      ) : (
                        <>
                          {item.nickname && <span className="nickname">{item.nickname}</span>}
                          <h4>{item.username}#{item.tag}</h4>
                          <p className="last-message">
                            {isSender ? 'You: ' : ''}{displayText}
                          </p>
                          <div className="last-message-time">{lastMsgTime}</div>
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
              <div 
                className={`chat-info ${selectedChat.isGroup ? 'group-chat' : ''}`}
                onClick={() => {
                  if (!selectedChat.isGroup) {
                    setPage(`viewProfile-${selectedChat.uid}`);
                  }
                }}
                style={{ cursor: selectedChat.isGroup ? 'default' : 'pointer' }}
              >
                <div className="current-chat-avatar">
                  {selectedChat.isGroup ? (
                    <>
                      <div className="group-avatar-emoji-large">👥</div>
                      <div className="current-status group"></div>
                    </>
                  ) : (
                    <>
                      <img src={selectedChat.avatar} alt="" />
                      <div className={`current-status ${selectedChat.online ? 'online' : 'offline'}`}></div>
                    </>
                  )}
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
                {!selectedChat.isGroup && (
                  <button 
                    className="profile-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPage(`viewProfile-${selectedChat.uid}`);
                    }}
                    title="View Profile"
                  >
                    👤
                  </button>
                )}
              </div>
              {selectedChat.isGroup && (
                <div className="group-actions">
                  <button className="secondary-button" onClick={() => viewGroupMembers(selectedChat.id)}>
                    Members
                  </button>
                  {selectedChat.createdBy === user.uid && (
                    <button className="secondary-button" onClick={() => openAddMembersModal(selectedChat.id)}>
                      Add Members
                    </button>
                  )}
                  {selectedChat.createdBy === user.uid ? (
                    <button className="danger-button" onClick={() => deleteDoc(doc(db, 'groups', selectedChat.id))}>
                      Delete
                    </button>
                  ) : (
                    <button className="danger-button" onClick={async () => {
                      const groupRef = doc(db, 'groups', selectedChat.id);
                      const groupSnap = await getDoc(groupRef);
                      if (groupSnap.exists()) {
                        const currentMembers = groupSnap.data().members || [];
                        const updatedMembers = currentMembers.filter(member => member !== user.uid);
                        await updateDoc(groupRef, { members: updatedMembers });
                        setSelectedChat(null);
                      }
                    }}>
                      Leave
                    </button>
                  )}
                </div>
              )}
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
                    const seenStatus = getSeenStatus(msg);
                    const groupSeenUsers = getGroupSeenUsers(msg);
                    
                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble ${msg.senderId === user.uid ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          {selectedChat.isGroup && msg.senderId !== user.uid && (
                            <div className="sender-name">{msg.senderName}</div>
                          )}
                          {msg.replyTo && (
                            <div className="reply-preview">
                              <div className="reply-line"></div>
                              <div className="reply-content">
                                <span className="reply-sender">{msg.replyTo.senderName}</span>
                                <p className="reply-text">{msg.replyTo.text}</p>
                              </div>
                            </div>
                          )}
                          <div className="message-text">{msg.text}</div>
                          <div className="message-footer">
                            <div className="message-info">
                              <span className="message-time">{formatTime(msg.createdAt)}</span>
                              {seenStatus && (
                                <span className="seen-status">{seenStatus}</span>
                              )}
                              {groupSeenUsers.length > 0 && (
                                <div className="group-seen-tooltip">
                                  {groupSeenUsers.slice(0, 3).map(user => user.username).join(', ')}
                                  {groupSeenUsers.length > 3 && ` and ${groupSeenUsers.length - 3} more`}
                                </div>
                              )}
                            </div>
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
                          <button className="reply-button" onClick={() => setReplyingTo(msg)}>↩️</button>
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
            {replyingTo && (
              <div className="reply-indicator">
                <div className="reply-indicator-content">
                  <span>Replying to {replyingTo.senderName}:</span>
                  <p>{replyingTo.text.length > 50 ? replyingTo.text.substring(0, 50) + '...' : replyingTo.text}</p>
                  <button className="cancel-reply" onClick={() => setReplyingTo(null)}>✕</button>
                </div>
              </div>
            )}
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

      {showAddMembersModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add Members to Group</h2>
              <button onClick={() => setShowAddMembersModal(false)}>✕</button>
            </div>
            <div className="modal-input">
              <label>Select Friends to Add</label>
              <div className="members-selector">
                {friends
                  .filter(f => f.uid !== user.uid)
                  .map(f => (
                    <div key={f.uid} className="member-option">
                      <input
                        type="checkbox"
                        checked={newMembers.includes(f.uid)}
                        onChange={() => toggleNewMember(f.uid)}
                        id={`new-member-${f.uid}`}
                      />
                      <label htmlFor={`new-member-${f.uid}`}>
                        <img src={f.avatar} alt="" className="member-avatar" />
                        <span>{f.nickname ? f.nickname : `${f.username}#${f.tag}`}</span>
                      </label>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={addMembersToGroup} disabled={newMembers.length === 0}>
                Add Selected Members
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowAddMembersModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupMembersModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Group Members</h2>
              <button onClick={() => setShowGroupMembersModal(false)}>✕</button>
            </div>
            <div className="members-list">
              {selectedGroupMembers.map(member => (
                <div key={member.uid} className="member-item" onClick={() => {
                  setShowGroupMembersModal(false);
                  setPage(`viewProfile-${member.uid}`);
                }}>
                  <img src={member.avatar} alt="" className="member-avatar" />
                  <div className="member-info">
                    <h4>{member.username}#{member.tag}</h4>
                    <p className={member.online ? 'online' : 'offline'}>
                      {member.online ? '● Online' : '○ Offline'}
                    </p>
                  </div>
                  {member.uid === selectedChat?.createdBy && (
                    <span className="admin-badge">Admin</span>
                  )}
                </div>
              ))}
            </div>
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
        <button className="back-button" onClick={() => setPage('chat')}>← Back</button>
        <h1>Add Friend</h1>
      </div>
      <div className="search-section">
        <div className="search-card">
          <h2>Find Friends</h2>
          <p>Search using username and tag</p>
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
            </div>
            <button type="submit" className="search-button" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          {error && <div className="alert error">⚠️ {error}</div>}
          {success && <div className="alert success">✓ {success}</div>}
          
          {searchResult && (
            <div className="result-card">
              <div className="result-header">
                <img src={searchResult.avatar} alt="" className="result-avatar" />
                <div className="result-info">
                  <h3>{searchResult.username}#{searchResult.tag}</h3>
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
            <p>Need to find someone's tag? Ask them to share their username#tag combination.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setPage, isOwnProfile }) {
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedBannerColor, setSelectedBannerColor] = useState(user?.bannerColor || BANNER_COLORS[0]);
  const [selectedCardColor, setSelectedCardColor] = useState(user?.cardColor || CARD_COLORS[0]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const [friendsData, setFriendsData] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);

  useEffect(() => {
    if (user?.friends) {
      loadFriendsData();
    }
  }, [user?.friends]);

  const loadFriendsData = async () => {
    const friendsArr = Array.isArray(user.friends) ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f) : [];
    const friendsList = [];
    
    for (const { userId } of friendsArr) {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          friendsList.push({ uid: userId, ...userSnap.data() });
        }
      } catch (err) {
        console.error('Error loading friend data:', err);
      }
    }
    
    setFriendsData(friendsList);
  };

  const lastChanged = user?.lastUsernameChange?.toDate?.() || null;
  const canChangeUsername = (() => {
    if (!lastChanged) return true;
    const now = new Date();
    const days = (now - lastChanged) / (1000 * 60 * 60 * 24);
    return days >= 7;
  })();

  const handleBioSave = async () => {
    if (bio.length > 150) {
      setError('Bio must be less than 150 characters');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { bio });
      setSuccess("Bio updated!");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError("Failed to update bio");
    }
    setLoading(false);
  };

  const handleColorSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        bannerColor: selectedBannerColor,
        cardColor: selectedCardColor
      });
      setSuccess("Profile colors updated!");
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError("Failed to update colors");
    }
    setLoading(false);
  };

  const handleUsernameConfirm = async () => {
    setLoading(true);
    try {
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
      setShowUsernameConfirm(false);
    } catch (err) {
      setError("Failed to update username");
    }
    setLoading(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toLocaleDateString) return 'Unknown';
    return timestamp.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const loadMutualFriends = async (targetUserId) => {
    const targetUserRef = doc(db, 'users', targetUserId);
    const targetUserSnap = await getDoc(targetUserRef);
    if (targetUserSnap.exists()) {
      const targetFriends = Array.isArray(targetUserSnap.data().friends) 
        ? targetUserSnap.data().friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
        : [];
      const myFriends = Array.isArray(user.friends) 
        ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
        : [];
      
      const mutual = [];
      for (const myFriend of myFriends) {
        if (targetFriends.some(tf => tf.userId === myFriend.userId)) {
          try {
            const friendRef = doc(db, 'users', myFriend.userId);
            const friendSnap = await getDoc(friendRef);
            if (friendSnap.exists()) {
              mutual.push({ uid: myFriend.userId, ...friendSnap.data() });
            }
          } catch (err) {
            console.error('Error loading mutual friend:', err);
          }
        }
      }
      setMutualFriends(mutual);
    }
  };

  useEffect(() => {
    if (!isOwnProfile) {
      loadMutualFriends(user.uid);
    }
  }, [user.uid, isOwnProfile]);

  return (
    <div className="profile-page">
      <div className="page-header">
        <button className="back-button" onClick={() => setPage('chat')}>← Back to Chat</button>
        <h1>Profile</h1>
      </div>
      <div className="profile-content">
        <div 
          className="profile-card"
          style={{ 
            background: selectedCardColor,
            border: `1px solid ${selectedCardColor === 'var(--bg-card)' ? 'var(--border)' : 'transparent'}`
          }}
        >
          <div 
            className="profile-banner"
            style={{ background: selectedBannerColor }}
          ></div>
          
          <div className="profile-header">
            <div className="avatar-container">
              <img src={user?.avatar} alt="" className="profile-avatar-large" />
              <div className="online-status">●</div>
            </div>
            
            <div className="username-form">
              <div className="username-display">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value.replace(/\s/g, ""))}
                  maxLength={20}
                  disabled={!canChangeUsername || loading || !isOwnProfile}
                  className="username-input"
                />
                <span className="user-tag-large">#{user.tag}</span>
              </div>
              
              {isOwnProfile && canChangeUsername && (
                <button 
                  className="update-button" 
                  onClick={() => setShowUsernameConfirm(true)}
                  disabled={loading || usernameInput === user.username}
                >
                  Update Username
                </button>
              )}
              
              {!canChangeUsername && isOwnProfile && (
                <p className="cooldown-notice">
                  Next username change available in {Math.ceil(7 - ((new Date() - lastChanged) / (1000 * 60 * 60 * 24)))} days
                </p>
              )}
            </div>
          </div>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="profile-section">
            <h3>Bio</h3>
            {isOwnProfile ? (
              <div className="bio-section">
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell everyone about yourself..."
                  maxLength={150}
                  className="bio-input"
                  rows="3"
                />
                <div className="bio-footer">
                  <span className="bio-counter">{bio.length}/150</span>
                  <button 
                    className="save-button"
                    onClick={handleBioSave}
                    disabled={loading || bio === user.bio}
                  >
                    Save Bio
                  </button>
                </div>
              </div>
            ) : (
              <p className="bio-text">{bio || 'No bio yet'}</p>
            )}
          </div>

          {!isOwnProfile && mutualFriends.length > 0 && (
            <div className="profile-section">
              <h3>Mutual Friends ({mutualFriends.length})</h3>
              <div className="mutual-friends">
                {mutualFriends.slice(0, 5).map(friend => (
                  <div 
                    key={friend.uid} 
                    className="mutual-friend"
                    onClick={() => setPage(`viewProfile-${friend.uid}`)}
                  >
                    <img src={friend.avatar} alt="" />
                    <span>{friend.username}</span>
                  </div>
                ))}
                {mutualFriends.length > 5 && (
                  <div className="mutual-friend more">
                    +{mutualFriends.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="profile-stats-grid">
            <div className="stat-item">
              <div className="stat-number">{friendsData.length}</div>
              <div className="stat-label">Friends</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{user?.online ? '●' : '○'}</div>
              <div className="stat-label">Status</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {new Date(user?.createdAt?.toDate?.()).getFullYear()}
              </div>
              <div className="stat-label">Joined</div>
            </div>
          </div>

          {isOwnProfile && (
            <div className="profile-section">
              <h3>Customize Profile</h3>
              <div className="customization-section">
                <div className="color-picker">
                  <label>Banner Color</label>
                  <div className="color-options">
                    {BANNER_COLORS.map((color, index) => (
                      <button
                        key={index}
                        className={`color-option ${selectedBannerColor === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setSelectedBannerColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="color-picker">
                  <label>Card Color</label>
                  <div className="color-options">
                    {CARD_COLORS.map((color, index) => (
                      <button
                        key={index}
                        className={`color-option ${selectedCardColor === color ? 'selected' : ''}`}
                        style={{ 
                          background: color,
                          border: color === 'var(--bg-card)' ? '1px solid var(--border)' : 'none'
                        }}
                        onClick={() => setSelectedCardColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <button 
                  className="save-button"
                  onClick={handleColorSave}
                  disabled={loading || (selectedBannerColor === user.bannerColor && selectedCardColor === user.cardColor)}
                >
                  Save Colors
                </button>
              </div>
            </div>
          )}

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

      {showUsernameConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Confirm Username Change</h2>
              <button onClick={() => setShowUsernameConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>You can only change your username once every 7 days.</p>
              <p>Are you sure you want to change your username to <strong>{usernameInput}</strong>?</p>
            </div>
            <div className="modal-actions">
              <button className="primary-button" onClick={handleUsernameConfirm} disabled={loading}>
                {loading ? 'Updating...' : 'Confirm Change'}
              </button>
              <button className="secondary-button" onClick={() => setShowUsernameConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewProfilePage({ user, setPage, profileId }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friendsData, setFriendsData] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [showActions, setShowActions] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfileData();
  }, [profileId]);

  useEffect(() => {
    if (profileData?.friends) {
      loadFriendsData();
      loadMutualFriends();
    }
  }, [profileData]);

  const loadProfileData = async () => {
    try {
      const userRef = doc(db, 'users', profileId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setProfileData({ uid: profileId, ...userSnap.data() });
        
        const myFriends = Array.isArray(user.friends) 
          ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
          : [];
        const friend = myFriends.find(f => f.userId === profileId);
        if (friend) {
          setNicknameInput(friend.nickname || '');
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
    setLoading(false);
  };

  const loadFriendsData = async () => {
    const friendsArr = Array.isArray(profileData.friends) 
      ? profileData.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
      : [];
    const friendsList = [];
    
    for (const { userId } of friendsArr.slice(0, 10)) {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          friendsList.push({ uid: userId, ...userSnap.data() });
        }
      } catch (err) {
        console.error('Error loading friend data:', err);
      }
    }
    
    setFriendsData(friendsList);
  };

  const loadMutualFriends = async () => {
    const targetFriends = Array.isArray(profileData.friends) 
      ? profileData.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
      : [];
    const myFriends = Array.isArray(user.friends) 
      ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
      : [];
    
    const mutual = [];
    for (const myFriend of myFriends) {
      if (targetFriends.some(tf => tf.userId === myFriend.userId)) {
        try {
          const friendRef = doc(db, 'users', myFriend.userId);
          const friendSnap = await getDoc(friendRef);
          if (friendSnap.exists()) {
            mutual.push({ uid: myFriend.userId, ...friendSnap.data() });
          }
        } catch (err) {
          console.error('Error loading mutual friend:', err);
        }
      }
    }
    setMutualFriends(mutual);
  };

  const handleRemoveFriend = async () => {
    try {
      const myFriends = Array.isArray(user.friends) 
        ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
        : [];
      await updateDoc(doc(db, 'users', user.uid), {
        friends: myFriends.filter(f => f.userId !== profileId)
      });
      
      const theirFriends = Array.isArray(profileData.friends) 
        ? profileData.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
        : [];
      await updateDoc(doc(db, 'users', profileId), {
        friends: theirFriends.filter(f => f.userId !== user.uid)
      });
      
      setSuccess("Friend removed");
      setTimeout(() => {
        setSuccess('');
        setPage('chat');
      }, 1500);
    } catch (err) {
      setError('Failed to remove friend');
    }
  };

  const handleUpdateNickname = async () => {
    try {
      const myFriends = Array.isArray(user.friends) 
        ? user.friends.map(f => typeof f === "string" ? { userId: f, nickname: "" } : f)
        : [];
      const updatedFriends = myFriends.map(f => 
        f.userId === profileId ? { ...f, nickname: nicknameInput } : f
      );
      await updateDoc(doc(db, 'users', user.uid), { friends: updatedFriends });
      setSuccess("Nickname updated");
      setEditingNickname(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update nickname');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toLocaleDateString) return 'Unknown';
    return timestamp.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading Profile</div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="profile-page">
        <div className="page-header">
          <button className="back-button" onClick={() => setPage('chat')}>← Back</button>
          <h1>Profile Not Found</h1>
        </div>
      </div>
    );
  }

  const isFriend = Array.isArray(user.friends) 
    ? user.friends.some(f => {
        const friend = typeof f === "string" ? { userId: f, nickname: "" } : f;
        return friend.userId === profileId;
      })
    : false;

  return (
    <div className="profile-page">
      <div className="page-header">
        <button className="back-button" onClick={() => setPage('chat')}>← Back to Chat</button>
        <h1>Profile</h1>
      </div>
      <div className="profile-content">
        <div 
          className="profile-card"
          style={{ 
            background: profileData.cardColor || CARD_COLORS[0],
            border: `1px solid ${profileData.cardColor === 'var(--bg-card)' ? 'var(--border)' : 'transparent'}`
          }}
        >
          <div 
            className="profile-banner"
            style={{ background: profileData.bannerColor || BANNER_COLORS[0] }}
          ></div>
          
          <div className="profile-header">
            <div className="avatar-container">
              <img src={profileData.avatar} alt="" className="profile-avatar-large" />
              <div className={`online-status ${profileData.online ? 'online' : 'offline'}`}>
                {profileData.online ? '●' : '○'}
              </div>
            </div>
            
            <div className="username-form">
              <div className="username-display">
                <h2 className="username-view">{profileData.username}</h2>
                <span className="user-tag-large">#{profileData.tag}</span>
              </div>
              
              {isFriend && (
                <div className="friend-actions-container">
                  <button 
                    className="action-toggle"
                    onClick={() => setShowActions(!showActions)}
                  >
                    {showActions ? '▲' : '▼'} Actions
                  </button>
                  
                  {showActions && (
                    <div className="actions-dropdown">
                      {editingNickname ? (
                        <div className="nickname-edit-form">
                          <input
                            type="text"
                            value={nicknameInput}
                            onChange={e => setNicknameInput(e.target.value)}
                            placeholder="Enter nickname"
                            maxLength={20}
                          />
                          <button onClick={handleUpdateNickname}>Save</button>
                          <button onClick={() => setEditingNickname(false)}>Cancel</button>
                        </div>
                      ) : (
                        <button 
                          className="dropdown-button"
                          onClick={() => setEditingNickname(true)}
                        >
                          Edit Nickname
                        </button>
                      )}
                      <button 
                        className="dropdown-button danger"
                        onClick={handleRemoveFriend}
                      >
                        Remove Friend
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="profile-section">
            <h3>Bio</h3>
            <p className="bio-text">{profileData.bio || 'No bio yet'}</p>
          </div>

          {mutualFriends.length > 0 && (
            <div className="profile-section">
              <h3>Mutual Friends ({mutualFriends.length})</h3>
              <div className="mutual-friends">
                {mutualFriends.slice(0, 5).map(friend => (
                  <div 
                    key={friend.uid} 
                    className="mutual-friend"
                    onClick={() => setPage(`viewProfile-${friend.uid}`)}
                  >
                    <img src={friend.avatar} alt="" />
                    <span>{friend.username}</span>
                  </div>
                ))}
                {mutualFriends.length > 5 && (
                  <div className="mutual-friend more">
                    +{mutualFriends.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="profile-stats-grid">
            <div className="stat-item">
              <div className="stat-number">{friendsData.length}</div>
              <div className="stat-label">Friends</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{profileData.online ? '●' : '○'}</div>
              <div className="stat-label">Status</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {new Date(profileData.createdAt?.toDate?.()).getFullYear()}
              </div>
              <div className="stat-label">Joined</div>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-item">
              <span className="detail-icon">📅</span>
              <div className="detail-content">
                <div className="detail-label">Member Since</div>
                <div className="detail-value">{formatDate(profileData.createdAt?.toDate?.())}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;