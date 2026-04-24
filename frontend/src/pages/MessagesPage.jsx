/**
 * MessagesPage — Real Firestore messaging.
 * Messages stored in organizations/{orgId}/messages.
 * Non-admin roles only see messages where they are sender or recipient.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  doc, setDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { orgAPI } from '../services/api';
import {
  MessageSquare, Send, Search, User, RefreshCw, Package, Users
} from 'lucide-react';

export default function MessagesPage() {
  const { userProfile, isAdmin, isManager } = useAuth();
  const [messages, setMessages]     = useState([]);
  const [threads, setThreads]       = useState([]);
  const [activeThread, setActive]   = useState(null);
  const [newMsg, setNewMsg]         = useState('');
  const [sending, setSending]       = useState(false);
  const [orgUsers, setOrgUsers]     = useState([]);
  const [showCompose, setCompose]   = useState(false);
  const [composeTo, setComposeTo]   = useState('');
  const [composeShipment, setComposeShipment] = useState('');
  const [search, setSearch]         = useState('');
  const messagesEndRef = useRef(null);

  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;
  const role  = userProfile?.role;

  // Load org users for compose
  useEffect(() => {
    orgAPI.listUsers().then(r => setOrgUsers(r.data.users||[])).catch(()=>{});
  }, []);

  // Real-time messages listener
  useEffect(() => {
    if (!orgId) return;
    const msgCol = collection(db, 'organizations', orgId, 'messages');

    let q;
    if (isAdmin || isManager) {
      // Admin/Manager see all org messages
      q = query(msgCol, orderBy('created_at', 'desc'), limit(200));
    } else {
      // Other roles see only their own messages
      q = query(
        msgCol,
        where('sender_id', '==', uid),
        orderBy('created_at', 'desc'),
        limit(100)
      );
    }

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(all);

      // Group into threads by shipment_id or recipient pair
      const threadMap = {};
      all.forEach(m => {
        const key = m.shipment_id
          ? `shipment:${m.shipment_id}`
          : [m.sender_id, m.recipient_id].sort().join(':');
        if (!threadMap[key]) {
          threadMap[key] = {
            key,
            type: m.shipment_id ? 'shipment' : 'direct',
            shipment_id: m.shipment_id,
            participants: [m.sender_id, m.recipient_id].filter(Boolean),
            last_message: m,
            count: 0,
            unread: 0,
          };
        }
        threadMap[key].count++;
        if (!m.read && m.recipient_id === uid) threadMap[key].unread++;
        if (!threadMap[key].last_message || m.created_at > threadMap[key].last_message.created_at) {
          threadMap[key].last_message = m;
        }
      });
      const threadList = Object.values(threadMap).sort((a,b) => {
        const at = a.last_message?.created_at?.toDate?.()?.getTime() || 0;
        const bt = b.last_message?.created_at?.toDate?.()?.getTime() || 0;
        return bt - at;
      });
      setThreads(threadList);
    }, () => {});

    return unsub;
  }, [orgId, uid, isAdmin, isManager]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread, messages]);

  const threadMessages = activeThread
    ? messages.filter(m =>
        activeThread.type === 'shipment'
          ? m.shipment_id === activeThread.shipment_id
          : [m.sender_id, m.recipient_id].includes(activeThread.participants[0]) &&
            [m.sender_id, m.recipient_id].includes(activeThread.participants[1])
      ).reverse()
    : [];

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread) return;
    setSending(true);
    try {
      const msgRef = doc(collection(db, 'organizations', orgId, 'messages'));
      await setDoc(msgRef, {
        content: newMsg.trim(),
        sender_id: uid,
        sender_name: userProfile?.displayName || userProfile?.email,
        recipient_id: activeThread.type === 'direct'
          ? activeThread.participants.find(p => p !== uid)
          : null,
        recipient_role: activeThread.type === 'direct' ? null : 'all',
        shipment_id: activeThread.shipment_id || null,
        message_type: 'text',
        read: false,
        created_at: serverTimestamp(),
      });
      setNewMsg('');
    } finally { setSending(false); }
  };

  const sendNewMessage = async () => {
    if (!newMsg.trim() || !composeTo) return;
    setSending(true);
    try {
      const msgRef = doc(collection(db, 'organizations', orgId, 'messages'));
      await setDoc(msgRef, {
        content: newMsg.trim(),
        sender_id: uid,
        sender_name: userProfile?.displayName || userProfile?.email,
        recipient_id: composeTo,
        recipient_role: null,
        shipment_id: composeShipment || null,
        message_type: 'text',
        read: false,
        created_at: serverTimestamp(),
      });
      setNewMsg(''); setCompose(false); setComposeTo(''); setComposeShipment('');
    } finally { setSending(false); }
  };

  const getUserName = (uid) => {
    const u = orgUsers.find(x => x.uid === uid);
    return u?.display_name || u?.email || uid?.substring(0,8) || '?';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate?.() || new Date(ts);
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  };

  const filteredThreads = threads.filter(t => {
    if (!search) return true;
    const other = t.participants.find(p => p !== uid);
    return getUserName(other)?.toLowerCase().includes(search.toLowerCase()) ||
           t.shipment_id?.includes(search);
  });

  return (
    <div style={{ display:'flex', height:'calc(100vh - var(--header-height) - 3rem)', gap:'1rem' }}>
      {/* Thread sidebar */}
      <div className="glass-card" style={{ width:300, display:'flex', flexDirection:'column', padding:0, overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'1rem', borderBottom:'1px solid var(--border-color-light)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <h3 style={{ fontWeight:700, display:'flex', alignItems:'center', gap:6, fontSize:'0.9375rem' }}>
              <MessageSquare size={16} style={{ color:'var(--accent-primary)' }}/> Messages
            </h3>
            <button className="btn btn-primary btn-sm" onClick={()=>setCompose(true)}>+ New</button>
          </div>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:'0.625rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input className="form-input" style={{ paddingLeft:'2rem', fontSize:'0.8125rem' }}
              placeholder="Search messages…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {filteredThreads.length === 0 ? (
            <div className="empty-state" style={{ padding:'2rem' }}>
              <MessageSquare size={28} className="empty-icon"/>
              <p>No messages yet</p>
            </div>
          ) : filteredThreads.map(t => {
            const other = t.participants.find(p => p !== uid);
            const isActive = activeThread?.key === t.key;
            return (
              <div key={t.key}
                onClick={() => setActive(t)}
                style={{
                  padding:'0.875rem 1rem',
                  borderBottom:'1px solid var(--border-color-light)',
                  cursor:'pointer',
                  background: isActive ? 'rgba(79,70,229,0.06)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  transition:'all var(--transition-fast)',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}>
                  <span style={{ fontWeight:600, fontSize:'0.8125rem', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:4 }}>
                    {t.type === 'shipment'
                      ? <><Package size={11}/> {t.shipment_id?.substring(0,10)}</>
                      : <><User size={11}/> {getUserName(other)}</>
                    }
                  </span>
                  <span style={{ fontSize:'0.625rem', color:'var(--text-muted)' }}>{formatTime(t.last_message?.created_at)}</span>
                </div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
                  {t.last_message?.content}
                </div>
                {t.unread > 0 && (
                  <div style={{ marginTop:'0.25rem' }}>
                    <span className="badge badge-purple">{t.unread} new</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message thread */}
      <div className="glass-card" style={{ flex:1, display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>
        {!activeThread && !showCompose ? (
          <div className="empty-state" style={{ flex:1 }}>
            <MessageSquare size={40} className="empty-icon"/>
            <p>Select a conversation or start a new message</p>
            <button className="btn btn-primary btn-sm" onClick={()=>setCompose(true)}>New Message</button>
          </div>
        ) : showCompose ? (
          <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            <h3 style={{ fontWeight:700, display:'flex', alignItems:'center', gap:6 }}><Users size={16} style={{color:'var(--accent-primary)'}}/>New Message</h3>
            <div className="form-group">
              <label className="form-label">To</label>
              <select className="form-select" value={composeTo} onChange={e=>setComposeTo(e.target.value)}>
                <option value="">Select recipient…</option>
                {orgUsers.filter(u=>u.uid!==uid).map(u=>(
                  <option key={u.uid} value={u.uid}>{u.display_name||u.email} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Related Shipment (optional)</label>
              <input className="form-input" value={composeShipment} onChange={e=>setComposeShipment(e.target.value)} placeholder="Shipment ID…"/>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-textarea" rows={4} value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Type your message…"/>
            </div>
            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button className="btn btn-primary" onClick={sendNewMessage} disabled={sending||!composeTo||!newMsg.trim()}>
                <Send size={14}/> {sending?'Sending…':'Send'}
              </button>
              <button className="btn btn-ghost" onClick={()=>setCompose(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid var(--border-color-light)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:'0.9375rem', display:'flex', alignItems:'center', gap:6, color:'var(--text-primary)' }}>
                {activeThread.type === 'shipment'
                  ? <><Package size={16} style={{color:'var(--accent-primary)'}}/> Shipment {activeThread.shipment_id?.substring(0,12)}</>
                  : <><User size={16} style={{color:'var(--accent-primary)'}}/> {getUserName(activeThread.participants.find(p=>p!==uid))}</>
                }
              </div>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{threadMessages.length} message{threadMessages.length!==1?'s':''}</span>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
              {threadMessages.map(m => {
                const isMine = m.sender_id === uid;
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth:'72%',
                      padding:'0.625rem 0.875rem',
                      background: isMine ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: isMine ? '#fff' : 'var(--text-primary)',
                      borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      border: isMine ? 'none' : '1px solid var(--border-color-light)',
                      fontSize:'0.875rem',
                      lineHeight:1.5,
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      {!isMine && <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--accent-primary)', marginBottom:'0.25rem' }}>{m.sender_name}</div>}
                      {m.content}
                      <div style={{ fontSize:'0.625rem', marginTop:'0.25rem', opacity:0.65, textAlign:'right' }}>{formatTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:'0.875rem 1.25rem', borderTop:'1px solid var(--border-color-light)', display:'flex', gap:'0.625rem' }}>
              <input
                className="form-input"
                value={newMsg}
                onChange={e=>setNewMsg(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message… (Enter to send)"
                disabled={sending}
                style={{ flex:1 }}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={sending||!newMsg.trim()} style={{ padding:'0.5rem 1rem' }}>
                {sending ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14}/>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
