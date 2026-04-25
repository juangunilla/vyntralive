'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import api from '../../../lib/api';
import LiveKitVideo from '../../../components/LiveKitVideo';
import { getStoredUser, setStoredUser } from '../../../lib/session';

const ROOM_TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'private', label: 'Privado', icon: '🔒' },
  { id: 'tokens', label: 'Fichas / Tokens', icon: '💎' },
  { id: 'bio', label: 'Biografía', icon: '🧷' },
  { id: 'more', label: 'Más salas', icon: '🧭' },
];

const SOCIAL_UNLOCK_COST = 40;
const TIP_GOAL_TOTAL = 888;
const INITIAL_TIP_GOAL = 94;
const INITIAL_LARGEST_TIP = { name: 'Nina Live', amount: 250 };
const INITIAL_LAST_TIP = { name: 'Axel Room', amount: 25 };

const FALLBACK_COUNTRIES = ['Argentina', 'México', 'Colombia', 'Chile', 'Uruguay', 'España'];
const FALLBACK_DISCOVERY_ROOMS = [
  {
    title: 'Late Night Lobby',
    host: 'Nina Live',
    viewers: 1842,
    country: 'Argentina',
    theme: 'IRL',
    note: 'Chat prendido y room con mucha actividad.',
  },
  {
    title: 'Studio Vibes',
    host: 'Axel Room',
    viewers: 963,
    country: 'México',
    theme: 'Studio',
    note: 'Formato limpio, cámara full y propinas activas.',
  },
  {
    title: 'After Hours Set',
    host: 'Mika On Air',
    viewers: 731,
    country: 'Colombia',
    theme: 'Music',
    note: 'Directo constante con comunidad muy presente.',
  },
  {
    title: 'Cozy Gamer Cam',
    host: 'Luna Pixel',
    viewers: 588,
    country: 'Chile',
    theme: 'Gaming',
    note: 'Pantalla compartida y chat con ritmo alto.',
  },
  {
    title: 'Mirror Lounge',
    host: 'Sofi Keys',
    viewers: 421,
    country: 'Uruguay',
    theme: 'IRL',
    note: 'Charla cercana, tips y privados activos.',
  },
  {
    title: 'Sunset Studio',
    host: 'Tana Live',
    viewers: 350,
    country: 'España',
    theme: 'Studio',
    note: 'Mini set nocturno para descubrir nuevas salas.',
  },
];

const formatCount = (value) => new Intl.NumberFormat('es-AR').format(Number(value || 0));

const formatCompactCount = (value) => new Intl.NumberFormat('es-AR', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0));

const getInitials = (name = '') => (
  name
    .split(' ')
    .map((part) => part?.[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'LV'
);

const splitEntries = (value = '') => (
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
);

const parseSocialEntries = (value = '') => (
  splitEntries(value).map((entry) => {
    const [labelPart, urlPart] = entry.split('|').map((item) => item.trim());
    if (urlPart) {
      return { label: labelPart, url: urlPart };
    }

    return { label: entry, url: '' };
  })
);

const getBroadcastModeLabel = (mode) => (mode === 'obs' ? 'OBS' : 'Browser');

const getStreamTheme = (stream, fallbackIndex = 0) => {
  const content = `${stream?.title || ''} ${stream?.creator?.bio || ''} ${stream?.creator?.aboutMe || ''}`.toLowerCase();

  if (stream?.broadcastMode === 'obs') {
    return 'Studio';
  }

  if (/music|dj|song|set|beat/.test(content)) {
    return 'Music';
  }

  if (/game|gaming|play|rank|match/.test(content)) {
    return 'Gaming';
  }

  if (/chat|talk|irl|lobby|late|night|room/.test(content)) {
    return 'IRL';
  }

  if ((Number(stream?.viewers) || 0) > 1000) {
    return 'Top';
  }

  return ['IRL', 'Music', 'Gaming', 'Studio'][fallbackIndex % 4];
};

const buildDiscoveryRoom = (stream, fallbackIndex = 0) => ({
  id: stream?._id || `fallback-${fallbackIndex}`,
  href: stream?._id ? `/stream/${stream._id}` : '/streams',
  title: stream?.title || stream?.creator?.name || 'Sala en vivo',
  host: stream?.creator?.name || 'Streamer',
  viewers: Number(stream?.viewers || 0),
  theme: getStreamTheme(stream, fallbackIndex),
  country: stream?.creator?.country || stream?.creator?.location || FALLBACK_COUNTRIES[fallbackIndex % FALLBACK_COUNTRIES.length],
  thumbnail: stream?.creator?.coverImage || stream?.creator?.avatar || '',
  note: stream?.creator?.aboutMe || stream?.creator?.bio || stream?.title || 'Room activa para descubrir.',
  isLive: stream?.status === 'live',
  mode: stream?.broadcastMode || 'browser',
});

const buildDiscoveryRooms = (stream, activeStreams = []) => {
  const liveRooms = activeStreams
    .filter((item) => item?._id !== stream?._id)
    .map((item, index) => buildDiscoveryRoom(item, index));

  if (liveRooms.length > 0) {
    const fallbackRooms = FALLBACK_DISCOVERY_ROOMS.map((item, index) => ({
      id: `fallback-${index}`,
      href: '/streams',
      title: item.title,
      host: item.host,
      viewers: item.viewers,
      theme: item.theme,
      country: item.country,
      thumbnail: '',
      note: item.note,
      isLive: true,
      mode: item.theme === 'Studio' ? 'obs' : 'browser',
    }));

    return [...liveRooms, ...fallbackRooms].slice(0, 8);
  }

  return FALLBACK_DISCOVERY_ROOMS.map((item, index) => ({
    id: `fallback-${index}`,
    href: '/streams',
    title: item.title,
    host: item.host,
    viewers: item.viewers,
    theme: item.theme,
    country: item.country,
    thumbnail: '',
    note: item.note,
    isLive: true,
    mode: item.theme === 'Studio' ? 'obs' : 'browser',
  }));
};

const makeChatMessage = (payload) => ({
  id: payload?.id || `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  kind: 'message',
  userId: payload?.userId || null,
  name: payload?.name || payload?.userName || 'Usuario',
  text: payload?.text || payload?.content || '',
  createdAt: payload?.createdAt || new Date().toISOString(),
});

const makeSystemMessage = (payload) => ({
  id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  kind: 'system',
  name: 'Sistema',
  text: typeof payload === 'string' ? payload : payload?.text || payload?.message || '',
  createdAt: payload?.createdAt || new Date().toISOString(),
});

const makeTipMessage = (payload) => {
  const amount = Number(payload?.amount || 0);

  return {
    id: payload?.id || `tip-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: 'tip',
    userId: payload?.userId || null,
    name: payload?.name || payload?.userName || 'Usuario',
    amount,
    text: payload?.text || `mandó ${amount} fichas`,
    balanceAfter: Number(payload?.balanceAfter || 0),
    createdAt: payload?.createdAt || new Date().toISOString(),
  };
};

export default function StreamPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const seenTipIdsRef = useRef(new Set());
  const roomEndTimerRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [activeStreams, setActiveStreams] = useState([]);
  const [privateSessionConfig, setPrivateSessionConfig] = useState(null);
  const [privateSessions, setPrivateSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [privateMinutes, setPrivateMinutes] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [socketConnected, setSocketConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => getStoredUser());
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [tipAmount, setTipAmount] = useState('25');
  const [tipping, setTipping] = useState(false);
  const [privateBusy, setPrivateBusy] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  const [tipMessageType, setTipMessageType] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [socialsUnlocked, setSocialsUnlocked] = useState(false);
  const [tipGoalProgress, setTipGoalProgress] = useState(INITIAL_TIP_GOAL);
  const [largestTip, setLargestTip] = useState(INITIAL_LARGEST_TIP);
  const [lastTip, setLastTip] = useState(INITIAL_LAST_TIP);

  const currentUserId = user?._id || user?.id;
  const creatorId = stream?.creator?._id || stream?.creator?.id;
  const creatorName = stream?.creator?.name || 'Streamer';
  const streamTitle = stream?.title || 'Sala en vivo';
  const isOwnStream = Boolean(currentUserId && creatorId && currentUserId === creatorId);
  const isStreamCreator = Boolean(user?.role === 'admin' || (currentUserId && creatorId && currentUserId === creatorId));
  const isLive = stream?.status === 'live';
  const canTipCreator = Boolean(user && isLive && !isOwnStream);
  const privatePricePerMinute = Number(privateSessionConfig?.ratePerMinute || 12);
  const privateMinMinutes = Number(privateSessionConfig?.minMinutes || 5);
  const privateUnlockCost = privatePricePerMinute * privateMinMinutes;
  const broadcastMode = stream?.broadcastMode || 'browser';
  const creatorGallery = Array.isArray(stream?.creator?.galleryImages) ? stream.creator.galleryImages : [];
  const canViewCreatorGallery = Boolean(user?.role === 'admin' || isOwnStream);
  const myPrivateSessions = useMemo(() => (
    privateSessions.filter((session) => {
      if (!currentUserId) return false;
      const sessionCreatorId = session?.creator?._id || session?.creator?.id;
      const sessionViewerId = session?.viewer?._id || session?.viewer?.id;
      return sessionCreatorId === currentUserId || sessionViewerId === currentUserId;
    })
  ), [currentUserId, privateSessions]);
  const pendingPrivateSessions = useMemo(() => (
    privateSessions.filter((session) => session?.status === 'pending')
  ), [privateSessions]);
  const currentPrivateSession = useMemo(() => (
    myPrivateSessions.find((session) => session?.status === 'active')
      || myPrivateSessions.find((session) => session?.status === 'confirmed')
      || myPrivateSessions.find((session) => session?.status === 'pending')
      || null
  ), [myPrivateSessions]);
  const currentPrivateSessionCreatorId = currentPrivateSession?.creator?._id || currentPrivateSession?.creator?.id;
  const currentPrivateSessionViewerId = currentPrivateSession?.viewer?._id || currentPrivateSession?.viewer?.id;
  const canEnterPrivateRoom = Boolean(
    currentPrivateSession
    && ['confirmed', 'active'].includes(currentPrivateSession.status)
    && currentUserId
    && (currentPrivateSessionCreatorId === currentUserId || currentPrivateSessionViewerId === currentUserId),
  );

  useEffect(() => {
    const syncUser = async () => {
      const storedUser = getStoredUser();
      setUser(storedUser);

      if (storedUser) {
        try {
          const response = await api.get('/users/profile');
          setStoredUser(response.data);
          setUser(response.data);
        } catch (error) {
          console.error('Error syncing user profile:', error);
        }
      }

      setSessionReady(true);
    };

    syncUser();
    window.addEventListener('session-updated', syncUser);

    return () => window.removeEventListener('session-updated', syncUser);
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && ROOM_TABS.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchStream = async () => {
      setLoading(true);
      setMessages([]);
      setViewerCount(0);
      setTipGoalProgress(INITIAL_TIP_GOAL);
      setLargestTip(INITIAL_LARGEST_TIP);
      setLastTip(INITIAL_LAST_TIP);
      seenTipIdsRef.current = new Set();

      try {
        const [streamResponse, activeResponse] = await Promise.all([
          api.get(`/streams/${params.id}`),
          api.get('/streams/active').catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        if (streamResponse.data?.status !== 'live') {
          router.replace('/streams');
          return;
        }

        setStream(streamResponse.data);
        setViewerCount(Number(streamResponse.data?.viewers || 0));
        setActiveStreams(Array.isArray(activeResponse.data) ? activeResponse.data : []);
      } catch (error) {
        if (!cancelled) {
          if (error.response?.status === 404) {
            router.replace('/streams');
            return;
          }

          console.error('Error fetching stream:', error);
          setStream(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStream();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!stream?._id || typeof window === 'undefined') return undefined;

    let cancelled = false;

    const loadPrivatePanel = async () => {
      try {
        const [privateConfigResponse, privateSessionsResponse] = await Promise.all([
          api.get('/private-sessions/config').catch(() => ({ data: null })),
          user
            ? api.get(`/private-sessions/streams/${stream._id}`).catch(() => ({ data: { sessions: [] } }))
            : Promise.resolve({ data: { sessions: [] } }),
        ]);

        if (cancelled) return;

        setPrivateSessionConfig(privateConfigResponse.data || null);
        setPrivateMinutes(String(privateConfigResponse.data?.minMinutes || 5));
        setPrivateSessions(Array.isArray(privateSessionsResponse.data?.sessions)
          ? privateSessionsResponse.data.sessions
          : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading private panel:', error);
        }
      }
    };

    loadPrivatePanel();

    return () => {
      cancelled = true;
    };
  }, [stream?._id, user?.id]);

  useEffect(() => {
    if (!stream?._id || typeof window === 'undefined') return;

    try {
      const storedState = JSON.parse(window.localStorage.getItem(`room-state:${stream._id}`) || '{}');
      if (typeof storedState.activeTab === 'string' && ROOM_TABS.some((tab) => tab.id === storedState.activeTab)) {
        setActiveTab(storedState.activeTab);
      }
      if (typeof storedState.selectedCategory === 'string') {
        setSelectedCategory(storedState.selectedCategory);
      }
      if (typeof storedState.following === 'boolean') {
        setIsFollowing(storedState.following);
      }
      if (typeof storedState.socialsUnlocked === 'boolean') {
        setSocialsUnlocked(storedState.socialsUnlocked);
      }
    } catch (error) {
      console.error('Error restoring room state:', error);
    }
  }, [stream?._id]);

  useEffect(() => {
    if (!stream?._id || typeof window === 'undefined') return;

    window.localStorage.setItem(
      `room-state:${stream._id}`,
      JSON.stringify({
        activeTab,
        selectedCategory,
        following: isFollowing,
        socialsUnlocked,
      }),
    );
  }, [stream?._id, activeTab, selectedCategory, isFollowing, socialsUnlocked]);

  useEffect(() => {
    if (!stream?._id || !isLive) return undefined;

    let cancelled = false;

    const verifyStreamIsStillLive = async () => {
      try {
        const response = await api.get(`/streams/${stream._id}`);
        if (cancelled) return;

        if (response.data?.status !== 'live') {
          setSocketConnected(false);
          setTipMessage('La room se cerró porque el streamer se desconectó.');
          setTipMessageType('warning');
          setViewerCount(0);
          setStream((current) => (current ? { ...current, status: 'offline', viewers: 0 } : current));
          window.setTimeout(() => {
            window.location.replace('/streams');
          }, 100);
        }
      } catch (error) {
        if (cancelled) return;

        console.error('Error verifying stream status:', error);
      }
    };

    const intervalId = window.setInterval(verifyStreamIsStillLive, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isLive, stream?._id]);

  useEffect(() => {
    if (!stream?._id || !sessionReady || !isLive) return undefined;

    const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const chatSocket = io(`${backendBaseUrl}/chat`, {
      transports: ['websocket'],
    });

    socketRef.current = chatSocket;

    const joinName = user?.name || 'Invitado';
    const joinUserId = currentUserId || stream._id.toString();

    const handleConnect = () => {
      setSocketConnected(true);
      chatSocket.emit('joinRoom', {
        streamId: stream._id,
        userId: joinUserId,
        name: joinName,
      });
      setViewerCount((current) => current + 1);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleNewMessage = (payload) => {
      setMessages((current) => [...current, makeChatMessage(payload)]);
    };

    const handleSystemMessage = (payload) => {
      setMessages((current) => [...current, makeSystemMessage(payload)]);
    };

    const handleTipMessage = (payload) => {
      const tip = makeTipMessage(payload);
      if (seenTipIdsRef.current.has(tip.id)) {
        return;
      }

      seenTipIdsRef.current.add(tip.id);
      setMessages((current) => [...current, tip]);
      setTipGoalProgress((current) => Math.min(TIP_GOAL_TOTAL, current + tip.amount));
      setLastTip({ name: tip.name, amount: tip.amount });
      setLargestTip((current) => (
        tip.amount > current.amount ? { name: tip.name, amount: tip.amount } : current
      ));

      if (tip.amount >= SOCIAL_UNLOCK_COST) {
        setSocialsUnlocked(true);
      }
    };

    const handleRoomEnded = (payload) => {
      const messageText = payload?.message || 'La room se cerró porque el streamer se desconectó.';
      setSocketConnected(false);
      setTipMessage(messageText);
      setTipMessageType('warning');
      setViewerCount(0);
      setStream((current) => (current ? { ...current, status: 'offline', viewers: 0 } : current));

      if (roomEndTimerRef.current) {
        window.clearTimeout(roomEndTimerRef.current);
      }

      roomEndTimerRef.current = window.setTimeout(() => {
        window.location.replace('/streams');
      }, 1200);
    };

    chatSocket.on('connect', handleConnect);
    chatSocket.on('disconnect', handleDisconnect);
    chatSocket.on('newMessage', handleNewMessage);
    chatSocket.on('systemMessage', handleSystemMessage);
    chatSocket.on('tipMessage', handleTipMessage);
    chatSocket.on('roomEnded', handleRoomEnded);

    if (chatSocket.connected) {
      handleConnect();
    }

    return () => {
      chatSocket.off('connect', handleConnect);
      chatSocket.off('disconnect', handleDisconnect);
      chatSocket.off('newMessage', handleNewMessage);
      chatSocket.off('systemMessage', handleSystemMessage);
      chatSocket.off('tipMessage', handleTipMessage);
      chatSocket.off('roomEnded', handleRoomEnded);

      if (roomEndTimerRef.current) {
        window.clearTimeout(roomEndTimerRef.current);
        roomEndTimerRef.current = null;
      }

      if (chatSocket.connected) {
        chatSocket.emit('leaveRoom', {
          streamId: stream._id,
          name: joinName,
        });
      }

      chatSocket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      setViewerCount((current) => Math.max(0, current - 1));
    };
  }, [stream?._id, currentUserId, isLive, sessionReady, user?.name]);

  useEffect(() => {
    if (!stream?._id || !sessionReady || !user) return undefined;

    let cancelled = false;

    const syncPrivateSessions = async () => {
      if (cancelled) return;
      await refreshPrivateSessions();
    };

    syncPrivateSessions();
    const intervalId = window.setInterval(syncPrivateSessions, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [stream?._id, sessionReady, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const discoveryRooms = useMemo(() => buildDiscoveryRooms(stream, activeStreams), [stream, activeStreams]);
  const discoveryCategories = useMemo(() => {
    const categories = new Set(['Todos']);
    discoveryRooms.forEach((room) => categories.add(room.theme));
    return Array.from(categories);
  }, [discoveryRooms]);

  useEffect(() => {
    if (selectedCategory !== 'Todos' && !discoveryCategories.includes(selectedCategory)) {
      setSelectedCategory('Todos');
    }
  }, [discoveryCategories, selectedCategory]);

  const tipHighlights = useMemo(
    () => messages.filter((entry) => entry.kind === 'tip').slice(-3).reverse(),
    [messages],
  );
  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;

    return messages.filter((entry) => (
      `${entry.name || ''} ${entry.text || ''} ${entry.amount || ''}`
        .toLowerCase()
        .includes(query)
    ));
  }, [messages, searchQuery]);
  const visibleDiscoveryRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const category = discoveryCategories.includes(selectedCategory) ? selectedCategory : 'Todos';

    return discoveryRooms.filter((room) => {
      const categoryMatch = category === 'Todos' || room.theme === category;
      const queryMatch = !query || (
        `${room.title} ${room.host} ${room.country} ${room.theme} ${room.note}`
          .toLowerCase()
          .includes(query)
      );

      return categoryMatch && queryMatch;
    });
  }, [discoveryCategories, discoveryRooms, searchQuery, selectedCategory]);
  const socialEntries = useMemo(() => {
    const parsed = parseSocialEntries(stream?.creator?.socials || '');
    return parsed.length > 0
      ? parsed
      : [
          { label: 'Instagram', url: '' },
          { label: 'X / Twitter', url: '' },
          { label: 'Telegram', url: '' },
        ];
  }, [stream?.creator?.socials]);

  const profileFacts = useMemo(() => {
    const followersEstimate = formatCompactCount(
      Math.max(4200, (viewerCount * 13) + 3600),
    );

    return [
      { label: 'Nombre', value: creatorName },
      { label: 'Edad', value: stream?.creator?.age || 24 },
      { label: 'Ubicación', value: stream?.creator?.location || 'Buenos Aires, AR' },
      { label: 'Seguidores', value: followersEstimate },
    ];
  }, [creatorName, stream?.creator?.age, stream?.creator?.location, viewerCount]);

  const handleSendMessage = () => {
    if (!message.trim() || !socketRef.current || !user || !isLive) {
      return;
    }

    socketRef.current.emit('sendMessage', {
      streamId: params.id,
      userId: currentUserId,
      text: message.trim(),
      name: user.name,
    });

    setMessage('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const registerLocalTipEvent = (payload) => {
    const tip = makeTipMessage(payload);
    if (!tip.id || seenTipIdsRef.current.has(tip.id)) {
      return;
    }

    seenTipIdsRef.current.add(tip.id);
    setMessages((current) => [...current, tip]);
    setTipGoalProgress((current) => Math.min(TIP_GOAL_TOTAL, current + tip.amount));
    setLastTip({ name: tip.name, amount: tip.amount });
    setLargestTip((current) => (
      tip.amount > current.amount ? { name: tip.name, amount: tip.amount } : current
    ));

    if (tip.amount >= SOCIAL_UNLOCK_COST) {
      setSocialsUnlocked(true);
    }
  };

  const handleTip = async (amount) => {
    if (!user) {
      setTipMessage('Inicia sesión para enviar propinas');
      setTipMessageType('error');
      return false;
    }

    if (!isLive) {
      setTipMessage('Solo puedes enviar propinas en transmisiones activas');
      setTipMessageType('error');
      return false;
    }

    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setTipMessage('El monto de la propina debe ser un entero positivo');
      setTipMessageType('error');
      return false;
    }

    setTipMessage('');
    setTipMessageType('');
    setTipping(true);

    try {
      const response = await api.post(`/streams/${params.id}/tip`, { amount: numericAmount });
      setStoredUser(response.data.user);
      setUser(response.data.user);
      setTipAmount('25');
      setTipMessage(response.data.message);
      setTipMessageType('success');

      registerLocalTipEvent({
        id: response.data.transaction?._id || response.data.transaction?.id,
        userId: response.data.user?._id || response.data.user?.id || currentUserId,
        name: response.data.user?.name || user.name,
        amount: response.data.amount || numericAmount,
        createdAt: response.data.transaction?.createdAt,
        balanceAfter: response.data.transaction?.balanceAfter,
        text: `mandó ${response.data.amount || numericAmount} fichas`,
      });

      return true;
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo enviar la propina');
      setTipMessageType('error');
      return false;
    } finally {
      setTipping(false);
    }
  };

  const handleFollowToggle = () => {
    if (!user) {
      setTipMessage('Inicia sesión para seguir a la streamer');
      setTipMessageType('error');
      return;
    }

    const next = !isFollowing;
    setIsFollowing(next);
    setTipMessage(next ? 'Ahora sigues esta room' : 'Dejaste de seguir esta room');
    setTipMessageType('success');
  };

  const handleSocialUnlock = async () => {
    if (!user) {
      setTipMessage('Inicia sesión para desbloquear redes');
      setTipMessageType('error');
      return;
    }

    if (isOwnStream) {
      setSocialsUnlocked(true);
      setTipMessage('Redes visibles en tu propio perfil');
      setTipMessageType('success');
      return;
    }

    if (socialsUnlocked) {
      return;
    }

    const success = await handleTip(SOCIAL_UNLOCK_COST);
    if (success) {
      setSocialsUnlocked(true);
      setTipMessage('Redes desbloqueadas');
      setTipMessageType('success');
    }
  };

  const updatePrivateSessionList = (nextSession) => {
    if (!nextSession) return;

    setPrivateSessions((current) => {
      const nextId = nextSession.id || nextSession._id;
      const filtered = current.filter((session) => (session.id || session._id) !== nextId);
      return [nextSession, ...filtered];
    });
  };

  const refreshPrivateSessions = async () => {
    if (!stream?._id || !user) {
      return;
    }

    try {
      const response = await api.get(`/private-sessions/streams/${stream._id}`);
      if (Array.isArray(response.data?.sessions)) {
        setPrivateSessions(response.data.sessions);
      }
    } catch (error) {
      console.error('Error refreshing private sessions:', error);
    }
  };

  const handlePrivateRequest = async () => {
    if (!user) {
      setTipMessage('Inicia sesión para reservar un privado');
      setTipMessageType('error');
      router.push(`/login?returnTo=${encodeURIComponent(`/stream/${params.id}?tab=private`)}`);
      return;
    }

    const requestedMinutes = Number(privateMinutes);
    if (!Number.isInteger(requestedMinutes) || requestedMinutes < privateMinMinutes) {
      setTipMessage(`El privado requiere al menos ${privateMinMinutes} minutos`);
      setTipMessageType('error');
      return;
    }

    setPrivateBusy(true);
    try {
      const response = await api.post(`/private-sessions/streams/${params.id}/request`, {
        minutes: requestedMinutes,
      });

      if (response.data?.user) {
        setStoredUser(response.data.user);
        setUser(response.data.user);
      }

      if (response.data?.session) {
        updatePrivateSessionList(response.data.session);
      }

      setTipMessage(response.data?.message || 'Privado reservado');
      setTipMessageType('success');
      setActiveTab('private');
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo reservar el privado');
      setTipMessageType('error');
    } finally {
      setPrivateBusy(false);
    }
  };

  const handlePrivateConfirm = async (sessionId) => {
    setPrivateBusy(true);
    try {
      const response = await api.post(`/private-sessions/${sessionId}/confirm`);
      if (response.data?.session) {
        updatePrivateSessionList(response.data.session);
      }
      setTipMessage(response.data?.message || 'Privado confirmado');
      setTipMessageType('success');
      await refreshPrivateSessions();
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo confirmar el privado');
      setTipMessageType('error');
    } finally {
      setPrivateBusy(false);
    }
  };

  const handlePrivateReject = async (sessionId) => {
    setPrivateBusy(true);
    try {
      const response = await api.post(`/private-sessions/${sessionId}/reject`);
      if (response.data?.session) {
        updatePrivateSessionList(response.data.session);
      }
      setTipMessage(response.data?.message || 'Privado rechazado');
      setTipMessageType('warning');
      await refreshPrivateSessions();
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo rechazar el privado');
      setTipMessageType('error');
    } finally {
      setPrivateBusy(false);
    }
  };

  const handlePrivateCancel = async (sessionId) => {
    setPrivateBusy(true);
    try {
      const response = await api.post(`/private-sessions/${sessionId}/cancel`);
      if (response.data?.session) {
        updatePrivateSessionList(response.data.session);
      }
      setTipMessage(response.data?.message || 'Privado cancelado');
      setTipMessageType('warning');
      await refreshPrivateSessions();
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo cancelar el privado');
      setTipMessageType('error');
    } finally {
      setPrivateBusy(false);
    }
  };

  const handleOpenPrivateCall = (sessionId) => {
    router.push(`/private/${sessionId}`);
  };

  const handlePrivateShortcut = () => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/stream/${params.id}?tab=private`)}`);
      return;
    }

    if (canEnterPrivateRoom && currentPrivateSession) {
      handleOpenPrivateCall(currentPrivateSession.id || currentPrivateSession._id);
      return;
    }

    setActiveTab('private');
  };

  const handlePrivateEnd = async (sessionId) => {
    setPrivateBusy(true);
    try {
      const response = await api.post(`/private-sessions/${sessionId}/end`);
      if (response.data?.session) {
        updatePrivateSessionList(response.data.session);
      }
      setTipMessage(response.data?.message || 'Privado finalizado');
      setTipMessageType('success');
      await refreshPrivateSessions();
    } catch (error) {
      setTipMessage(error.response?.data?.message || 'No se pudo finalizar el privado');
      setTipMessageType('error');
    } finally {
      setPrivateBusy(false);
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setTipMessage('Enlace de la room copiado');
      setTipMessageType('success');
    } catch (error) {
      setTipMessage('No se pudo copiar el enlace');
      setTipMessageType('error');
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const chatMessagesToShow = activeTab === 'chat' ? visibleMessages : messages;

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="loading">
            <div className="spinner"></div>
            Cargando transmisión...
          </div>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>❌ Transmisión no encontrada</h3>
            <p style={{ color: '#718096' }}>
              La transmisión que buscas no existe o ha terminado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content room-shell">
        <div className="room-header">
          <div className="room-header-copy">
            <span className="page-kicker">🔴 Room en directo</span>
            <div className="room-title-row">
              <h1>{creatorName}</h1>
              <button
                type="button"
                className={`btn btn-secondary room-follow-button ${isFollowing ? 'room-follow-button-active' : ''}`}
                onClick={handleFollowToggle}
              >
                {isFollowing ? 'Siguiendo' : 'Seguir'}
              </button>
            </div>
            <p className="page-subtitle">
              Video fijo arriba, chat en tiempo real, privados, fichas y más salas en una sala estilo directorio live.
            </p>
            <div className="room-status-row">
              <span className={`status ${isLive ? 'status-live' : 'status-offline'}`}>
                {isLive ? `🔴 En directo · ${formatCount(viewerCount)} espectadores` : '⚫ OFFLINE'}
              </span>
              <span className="mode-badge">{getBroadcastModeLabel(broadcastMode)}</span>
              <span className="info-chip">👤 {streamTitle}</span>
              <span className="info-chip">💎 {user ? `${formatCount(user.credits || 0)} fichas` : 'Inicia sesión'}</span>
            </div>
          </div>

          <div className="room-header-actions">
            <label className="room-search-box">
              <span className="room-search-label">Buscar</span>
              <input
                type="search"
                className="form-input room-search-input"
                placeholder="Salas, chat, fichas o tags"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="room-action-row">
              <button
                type="button"
                className="btn btn-secondary room-menu-button"
                onClick={() => setMenuOpen((current) => !current)}
              >
                ☰ Menú
              </button>
            </div>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="room-menu-backdrop"
                  aria-label="Cerrar menú"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="room-menu-panel">
                  <div className="section-heading">
                    <div>
                      <span className="page-kicker">⚙️ Menú</span>
                      <h3>Atajos de la room</h3>
                    </div>
                  </div>

                  <div className="room-menu-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => { copyRoomLink(); setMenuOpen(false); }}>
                      🔗 Copiar enlace
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('chat'); setMenuOpen(false); }}>
                      💬 Ir al chat
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('bio'); setMenuOpen(false); }}>
                      🧷 Ver biografía
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('more'); setMenuOpen(false); }}>
                      🧭 Más salas
                    </button>
                    <Link href="/streams" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                      📺 Volver al directorio
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="room-layout">
          <div className="room-main-column">
            <section className="card stage-card room-stage-shell">
              <div className="room-stage-header">
                <div className="room-stage-toprow">
                  <div className="room-stage-title">
                    <span className="page-kicker">📺 Video fijo arriba</span>
                    <h2>{streamTitle}</h2>
                    <p className="page-subtitle">
                      {stream?.creator?.bio || stream?.creator?.aboutMe || 'Mirá el stage principal, seguí la conversación y desbloqueá interacciones con fichas.'}
                    </p>
                  </div>

                  <div className="room-stage-meta">
                    <span className={`status ${isLive ? 'status-live' : 'status-offline'}`}>
                      {isLive ? '🟢 EN VIVO' : '⚫ OFFLINE'}
                    </span>
                    <span className="info-chip">👥 {formatCount(viewerCount)}</span>
                    <span className="info-chip">🎛️ {broadcastMode === 'obs' ? 'OBS' : 'Browser'}</span>
                    <span className="info-chip">🏷️ {getStreamTheme(stream)}</span>
                  </div>
                </div>

                {tipMessage && (
                  <div className={`room-notice ${tipMessageType === 'error' ? 'error' : tipMessageType === 'warning' ? 'warning' : 'success'}`}>
                    {tipMessage}
                  </div>
                )}
              </div>

              <div className="room-stage-media">
                {isLive ? (
                  <LiveKitVideo
                    roomName={stream.roomName}
                    streamId={stream._id}
                    broadcastMode={broadcastMode}
                    allowGuestPreview={!user}
                  />
                ) : (
                  <div className="video-placeholder">
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <h3>📭 Transmisión Finalizada</h3>
                      <p style={{ color: '#718096' }}>
                        Esta transmisión ya no está en vivo.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="room-tabs">
              {ROOM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`room-tab-button ${activeTab === tab.id ? 'room-tab-button-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <section className="room-tab-panel">
              {activeTab === 'chat' && (
                <div className="card room-chat-shell">
                  <div className="section-heading">
                    <div>
                      <span className="page-kicker">💬 Chat en tiempo real</span>
                      <h3>Mensajes del directo</h3>
                    </div>
                    <span className="info-chip">{socketConnected ? 'Conectado' : 'Conectando'}</span>
                  </div>

                  <div className="room-chat-highlights">
                    {tipHighlights.length > 0 ? (
                      tipHighlights.map((tip) => (
                        <div key={tip.id} className="room-tip-highlight">
                          <strong>💎 {tip.name}</strong>
                          <span>{formatCount(tip.amount)} fichas</span>
                        </div>
                      ))
                    ) : (
                      <div className="profile-empty-box">
                        Cuando alguien mande fichas, el mensaje destacado aparecerá acá.
                      </div>
                    )}
                  </div>

                  <div className="chat-messages">
                    {chatMessagesToShow.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>
                        <p>
                          {normalizedSearch
                            ? 'No encontramos mensajes con esa búsqueda.'
                            : 'Todavía no hay mensajes en el chat.'}
                        </p>
                      </div>
                    ) : (
                      chatMessagesToShow.map((entry) => {
                        const isOwnMessage = currentUserId && entry.userId && entry.userId === currentUserId;

                        if (entry.kind === 'system') {
                          return (
                            <div key={entry.id} className="chat-message chat-message-system">
                              <strong>{entry.name}</strong>
                              <span>{entry.text}</span>
                            </div>
                          );
                        }

                        if (entry.kind === 'tip') {
                          return (
                            <div key={entry.id} className="chat-message chat-message-tip">
                              <strong>{entry.name} · {formatCount(entry.amount)} fichas</strong>
                              <span>{entry.text}</span>
                            </div>
                          );
                        }

                        return (
                          <div key={entry.id} className={`chat-message ${isOwnMessage ? 'own' : 'other'}`}>
                            <strong>{entry.name}:</strong>
                            {entry.text}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {user ? (
                    <div className="chat-composer room-chat-footer">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Escribe algo con buena onda..."
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!isLive || !socketConnected}
                      />

                      <div className="room-chat-controls">
                        <div className="room-tip-row">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-input room-tip-input"
                            value={tipAmount}
                            onChange={(event) => setTipAmount(event.target.value)}
                            placeholder="Monto de fichas"
                            disabled={!isLive}
                          />

                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={tipping || !tipAmount || !isLive || !canTipCreator}
                            onClick={() => handleTip(tipAmount)}
                          >
                            {tipping ? 'Enviando...' : '💸 Enviar propina'}
                          </button>
                        </div>

                        <div className="room-cta-row">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSendMessage}
                            disabled={!message.trim() || !isLive || !socketConnected}
                          >
                            📤 Enviar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-auth-prompt">
                      <p style={{ color: '#718096', textAlign: 'center', margin: 0 }}>
                        🔐 <Link href="/login" className="inline-link">Inicia sesión</Link> para chatear y mandar fichas.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'private' && (
                <div className="card room-private-shell">
                  <div className="section-heading">
                    <div>
                      <span className="page-kicker">🔒 Privados</span>
                      <h3>Videollamada 1 a 1</h3>
                    </div>
                    <span className="info-chip">
                      {currentPrivateSession ? currentPrivateSession.status : 'Disponible'}
                    </span>
                  </div>

                  <div className="room-private-summary">
                    <div className="credit-grid compact-grid">
                      <div className="credit-card">
                        <span>Precio por minuto</span>
                        <strong className="credit-value">{privatePricePerMinute}</strong>
                      </div>
                      <div className="credit-card">
                        <span>Mínimo de minutos</span>
                        <strong className="credit-value">{privateMinMinutes}</strong>
                      </div>
                      <div className="credit-card">
                        <span>Reserva total</span>
                        <strong className="credit-value">{formatCount(privateUnlockCost)}</strong>
                      </div>
                      <div className="credit-card">
                        <span>Saldo del usuario</span>
                        <strong className="credit-value">{user ? formatCount(user.credits || 0) : '0'}</strong>
                      </div>
                    </div>

                    <div className="room-private-lock">
                      <strong>Regla de acceso</strong>
                      <p>
                        La videollamada queda bloqueada hasta que el backend confirme la reserva y la sala sólo acepta 2 participantes.
                      </p>
                      <p>
                        {privateSessionConfig
                          ? `Se cobra ${privatePricePerMinute} fichas por minuto con mínimo de ${privateMinMinutes} minutos.`
                          : 'Cargando configuración del privado...'}
                      </p>
                    </div>
                  </div>

                  {user ? (
                    <div className="room-private-form">
                      <div className="room-private-request-row">
                        <label className="room-search-box" style={{ flex: 1 }}>
                          <span className="room-search-label">Minutos</span>
                          <input
                            type="number"
                            min={privateMinMinutes}
                            step="1"
                            className="form-input room-search-input"
                            value={privateMinutes}
                            onChange={(event) => setPrivateMinutes(event.target.value)}
                            disabled={privateBusy || Boolean(currentPrivateSession && ['pending', 'confirmed', 'active'].includes(currentPrivateSession.status))}
                          />
                        </label>

                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={handlePrivateRequest}
                          disabled={privateBusy || !isLive || Boolean(currentPrivateSession && ['pending', 'confirmed', 'active'].includes(currentPrivateSession.status))}
                        >
                          {privateBusy ? 'Procesando...' : `Reservar privado · ${privateUnlockCost} fichas`}
                        </button>
                      </div>

                      <p className="page-subtitle">
                        El backend reserva el turno, confirma la sala y descuenta el saldo minuto a minuto mientras la videollamada esté activa.
                      </p>
                    </div>
                  ) : (
                    <div className="chat-auth-prompt">
                      <p style={{ color: '#718096', textAlign: 'center', margin: 0 }}>
                        🔐 <Link href="/login" className="inline-link">Inicia sesión</Link> para reservar una videollamada privada.
                      </p>
                    </div>
                  )}

                  {currentPrivateSession && (
                    <div className="credit-action-card">
                      <span className="page-kicker">Mi turno</span>
                      <h3>
                        {currentPrivateSession.status === 'active'
                          ? 'Videollamada en curso'
                          : currentPrivateSession.status === 'confirmed'
                            ? 'Privado confirmado'
                            : 'Reserva pendiente'}
                      </h3>
                      <p>
                        {currentPrivateSession.status === 'active'
                          ? 'El reloj ya está corriendo por minuto.'
                          : 'Esperando la confirmación del backend o del creador para abrir la sala.'}
                      </p>

                      <div className="credit-grid compact-grid">
                        <div className="credit-card">
                          <span>Minutos</span>
                          <strong className="credit-value">{formatCount(currentPrivateSession.requestedMinutes)}</strong>
                        </div>
                        <div className="credit-card">
                          <span>Cobrados</span>
                          <strong className="credit-value">{formatCount(currentPrivateSession.billedMinutes)}</strong>
                        </div>
                        <div className="credit-card">
                          <span>Reservados</span>
                          <strong className="credit-value">{formatCount(currentPrivateSession.reservedCredits)}</strong>
                        </div>
                        <div className="credit-card">
                          <span>Estado</span>
                          <strong className="credit-value">{currentPrivateSession.status}</strong>
                        </div>
                      </div>

                      <div className="room-cta-row">
                        {canEnterPrivateRoom && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleOpenPrivateCall(currentPrivateSession.id || currentPrivateSession._id)}
                          >
                            🎥 Abrir videollamada
                          </button>
                        )}

                        {currentPrivateSession.status === 'pending' && currentUserId === (currentPrivateSession.viewer?._id || currentPrivateSession.viewer?.id) && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handlePrivateCancel(currentPrivateSession.id || currentPrivateSession._id)}
                            disabled={privateBusy}
                          >
                            Cancelar reserva
                          </button>
                        )}

                        {currentPrivateSession.status === 'active' && currentUserId === (currentPrivateSession.creator?._id || currentPrivateSession.creator?.id) && (
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handlePrivateEnd(currentPrivateSession.id || currentPrivateSession._id)}
                            disabled={privateBusy}
                          >
                            Finalizar privado
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isStreamCreator && (
                    <div className="card" style={{ marginTop: '1rem' }}>
                      <div className="section-heading">
                        <div>
                          <span className="page-kicker">📥 Turnos pendientes</span>
                          <h3>Reservas esperando confirmación</h3>
                        </div>
                        <span className="info-chip">{pendingPrivateSessions.length}</span>
                      </div>

                      {pendingPrivateSessions.length === 0 ? (
                        <div className="profile-empty-box">
                          No hay reservas esperando aprobación ahora mismo.
                        </div>
                      ) : (
                        <div className="profile-list">
                          {pendingPrivateSessions.map((session) => {
                            const sessionId = session.id || session._id;
                            return (
                              <div key={sessionId} className="profile-list-item" style={{ display: 'grid', gap: '0.75rem' }}>
                                <div>
                                  <strong>{session.viewer?.name || 'Usuario'}</strong>
                                  <div style={{ color: '#718096', fontSize: '0.92rem' }}>
                                    {formatCount(session.requestedMinutes)} min · {formatCount(session.ratePerMinute)} fichas/min · {formatCount(session.totalCredits)} fichas
                                  </div>
                                  <div style={{ color: '#718096', fontSize: '0.92rem' }}>
                                    Estado: {session.status}
                                  </div>
                                </div>

                                <div className="room-cta-row">
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handlePrivateConfirm(sessionId)}
                                    disabled={privateBusy}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handlePrivateReject(sessionId)}
                                    disabled={privateBusy}
                                  >
                                    Rechazar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={() => handleOpenPrivateCall(sessionId)}
                                    disabled={!['confirmed', 'active'].includes(session.status)}
                                  >
                                    Abrir sala
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tokens' && (
                <div className="card room-token-shell">
                  <div className="section-heading">
                    <div>
                      <span className="page-kicker">💎 Fichas / Tokens</span>
                      <h3>Sistema de propinas y saldo</h3>
                    </div>
                    <span className="info-chip">{user ? 'Cuenta activa' : 'Solo lectura'}</span>
                  </div>

                  <div className="credit-grid">
                    <div className="credit-card">
                      <span>Saldo del usuario</span>
                      <strong className="credit-value">{user ? formatCount(user.credits || 0) : '0'}</strong>
                    </div>
                    <div className="credit-card">
                      <span>Meta de fichas</span>
                      <strong className="credit-value">
                        {formatCount(tipGoalProgress)} / {formatCount(TIP_GOAL_TOTAL)}
                      </strong>
                    </div>
                    <div className="credit-card">
                      <span>Mayor propina</span>
                      <strong className="credit-value">
                        {formatCount(largestTip.amount)}
                      </strong>
                      <span>{largestTip.name}</span>
                    </div>
                    <div className="credit-card">
                      <span>Última propina</span>
                      <strong className="credit-value">
                        {formatCount(lastTip.amount)}
                      </strong>
                      <span>{lastTip.name}</span>
                    </div>
                  </div>

                  <div className="room-progress">
                    <div className="room-progress-track">
                      <div
                        className="room-progress-fill"
                        style={{ width: `${Math.min(100, Math.round((tipGoalProgress / TIP_GOAL_TOTAL) * 100))}%` }}
                      />
                    </div>
                    <span className="page-subtitle">
                      Meta progresiva: {formatCount(tipGoalProgress)} de {formatCount(TIP_GOAL_TOTAL)} fichas.
                    </span>
                  </div>

                  <div className="room-token-actions">
                    <div className="room-token-row">
                      {[10, 25, 50, 100].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className={`btn btn-secondary ${tipAmount === String(amount) ? 'room-token-active' : ''}`}
                          onClick={() => setTipAmount(String(amount))}
                        >
                          💸 {amount}
                        </button>
                      ))}
                    </div>

                    <div className="room-cta-row">
                      <button
                        type="button"
                        className="btn btn-success"
                        disabled={tipping || !user || !isLive || !canTipCreator}
                        onClick={() => handleTip(tipAmount)}
                      >
                        {tipping ? 'Enviando...' : '💸 Dar propina'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSocialUnlock}
                        disabled={!user || socialsUnlocked || !isLive}
                      >
                        {socialsUnlocked ? '🔓 Redes desbloqueadas' : `📣 Desbloquear redes · ${SOCIAL_UNLOCK_COST}`}
                      </button>
                    </div>
                  </div>

                  {stream?.creator?.tipMenu && (
                    <div className="credit-action-card">
                      <span className="page-kicker">🍭 Tip menu</span>
                      <div className="profile-list">
                        {splitEntries(stream.creator.tipMenu).map((item) => (
                          <div key={item} className="profile-list-item">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bio' && (
                <div className="card room-bio-shell">
                  <div className="section-heading">
                    <div>
                      <span className="page-kicker">🧷 Biografía</span>
                      <h3>Perfil y presencia del streamer</h3>
                    </div>
                    <span className="info-chip">{user ? 'Perfil completo' : 'Vista pública'}</span>
                  </div>

                  <div className="room-bio-columns">
                    <div className="room-bio-stack">
                      <div className="credit-grid compact-grid">
                        {profileFacts.map((fact) => (
                          <div key={fact.label} className="credit-card">
                            <span>{fact.label}</span>
                            <strong className="credit-value">{fact.value}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="profile-section-card">
                        <span className="page-kicker">📝 Sobre mí</span>
                        <h3>{creatorName}</h3>
                        <p>{stream?.creator?.aboutMe || stream?.creator?.bio || 'Perfil preparado para live, chats con fichas y privados.'}</p>
                        {splitEntries(stream?.creator?.bio || stream?.creator?.aboutMe || '').length > 0 && (
                          <div className="profile-list">
                            {splitEntries(stream?.creator?.bio || stream?.creator?.aboutMe || '').map((item) => (
                              <div key={item} className="profile-list-item">
                                {item}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {stream?.creator?.wishlist && (
                        <div className="profile-section-card">
                          <span className="page-kicker">🎁 Wishlist</span>
                          <h3>Lo que más suma en la room</h3>
                          <div className="profile-list">
                            {splitEntries(stream.creator.wishlist).map((item) => (
                              <div key={item} className="profile-list-item">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {stream?.creator?.roomRules && (
                        <div className="profile-section-card">
                          <span className="page-kicker">📜 Reglas de la room</span>
                          <h3>Lo que conviene respetar</h3>
                          <div className="profile-list">
                            {splitEntries(stream.creator.roomRules).map((item) => (
                              <div key={item} className="profile-list-item">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="room-bio-stack">
                      <div className="profile-section-card">
                        <span className="page-kicker">🔗 Redes</span>
                        <h3>{socialsUnlocked ? 'Redes desbloqueadas' : 'Redes bloqueadas por fichas'}</h3>
                        <p>
                          {socialsUnlocked
                            ? 'Ya podés ver las redes sociales conectadas a la room.'
                            : `Mandá ${SOCIAL_UNLOCK_COST} fichas para desbloquearlas.`}
                        </p>

                        <div className="room-social-grid">
                          {socialEntries.map((social) => (
                            <div
                              key={social.label}
                              className={`room-social-pill ${socialsUnlocked ? '' : 'room-social-pill-locked'}`}
                            >
                              <strong>
                                {socialsUnlocked ? '🔓' : '🔒'}
                                {social.label}
                              </strong>
                              <small>
                                {socialsUnlocked
                                  ? social.url || 'Abierta'
                                  : 'Bloqueada hasta mandar fichas'}
                              </small>
                            </div>
                          ))}
                        </div>

                        {!socialsUnlocked && (
                          <div className="room-cta-row" style={{ marginTop: '1rem' }}>
                            <button
                              type="button"
                              className="btn btn-success"
                              onClick={handleSocialUnlock}
                              disabled={!user || !isLive}
                            >
                              📣 Desbloquear redes · {SOCIAL_UNLOCK_COST}
                            </button>
                          </div>
                        )}
                      </div>

                      {creatorGallery.length > 0 && (
                        <div className="creator-gallery-card">
                          <div className="section-heading">
                            <div>
                              <span className="page-kicker">🖼️ Galería</span>
                              <h3>Fotos de {creatorName}</h3>
                            </div>
                            <span className="info-chip">
                              {canViewCreatorGallery ? '👁️ Vista completa' : '🌫️ Blur para viewers'}
                            </span>
                          </div>

                          <p className="page-subtitle">
                            {canViewCreatorGallery
                              ? 'Como sos el dueño de estas fotos, la galería se muestra nítida.'
                              : 'El dueño las ve nítidas; para el resto de la room se muestran difuminadas.'}
                          </p>

                          <div className="creator-photo-grid">
                            {creatorGallery.map((photoUrl, index) => (
                              <div
                                key={`${photoUrl}-${index}`}
                                className={`creator-photo-tile ${canViewCreatorGallery ? '' : 'creator-photo-tile-locked'}`}
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Foto ${index + 1} de ${creatorName}`}
                                  loading="lazy"
                                />
                                {!canViewCreatorGallery && (
                                  <div className="creator-photo-overlay">
                                    <span>🔒 Vista difuminada</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'more' && (
                <div className="card room-discovery-shell">
                  <div className="room-discovery-toolbar">
                    <div className="section-heading">
                      <div>
                        <span className="page-kicker">🧭 Más salas</span>
                        <h3>Otros streamers en vivo</h3>
                      </div>
                      <p className="page-subtitle">
                        Grilla con miniatura, nombre, país y espectadores para saltar entre rooms activas.
                      </p>
                    </div>
                    <span className="info-chip">{visibleDiscoveryRooms.length} resultados</span>
                  </div>

                  <div className="room-category-row">
                    {discoveryCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`room-category-chip ${selectedCategory === category ? 'room-category-chip-active' : ''}`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="room-discovery-grid">
                    {visibleDiscoveryRooms.length === 0 ? (
                      <div className="profile-empty-box">
                        No encontramos salas para esa combinación de filtro y búsqueda.
                      </div>
                    ) : (
                      visibleDiscoveryRooms.map((room) => (
                        <Link key={room.id} href={room.href} className="room-discovery-card">
                          <div className="room-discovery-thumb">
                            {room.thumbnail ? (
                              <img src={room.thumbnail} alt={`Miniatura de ${room.host}`} />
                            ) : (
                              <div className="room-discovery-thumb-fallback">
                                {getInitials(room.host)}
                              </div>
                            )}

                            <span className={`status ${room.isLive ? 'status-live' : 'status-offline'}`}>
                              {room.isLive ? '🔴 live' : '⚫ offline'}
                            </span>
                          </div>

                          <div className="room-discovery-meta">
                            <strong>{room.title}</strong>
                            <p>{room.note}</p>
                            <div className="room-discovery-submeta">
                              <span>🌎 {room.country}</span>
                              <span>👤 {room.host}</span>
                            </div>
                          </div>

                          <div className="room-discovery-footer">
                            <span className="info-chip">👥 {formatCount(room.viewers)}</span>
                            <span className="mode-badge">{room.theme}</span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="room-sidebar">
            <div className="card room-sidebar-card">
              <div className="room-profile-hero">
                <div className="room-profile-top">
                  <div className="room-profile-avatar">
                    {stream?.creator?.avatar ? (
                      <img src={stream.creator.avatar} alt={`Avatar de ${creatorName}`} />
                    ) : (
                      <span className="room-profile-avatar-fallback">{getInitials(creatorName)}</span>
                    )}
                  </div>

                  <div className="room-profile-copy">
                    <strong>{creatorName}</strong>
                    <span>{streamTitle}</span>
                    <span className={`status ${isLive ? 'status-live' : 'status-offline'}`}>
                      {isLive ? `En directo · ${formatCount(viewerCount)} espectadores` : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="credit-grid compact-grid">
                  <div className="credit-card">
                    <span>Edad</span>
                    <strong className="credit-value">{stream?.creator?.age || 24}</strong>
                  </div>
                  <div className="credit-card">
                    <span>Ubicación</span>
                    <strong className="credit-value">{stream?.creator?.location || 'Buenos Aires'}</strong>
                  </div>
                  <div className="credit-card">
                    <span>Seguidores</span>
                    <strong className="credit-value">{formatCompactCount(Math.max(4200, viewerCount * 13 + 3600))}</strong>
                  </div>
                  <div className="credit-card">
                    <span>Modo</span>
                    <strong className="credit-value">{getBroadcastModeLabel(broadcastMode)}</strong>
                  </div>
                </div>

                <div className="room-cta-row">
                  {user ? (
                    <button
                      type="button"
                      className={`btn btn-secondary room-follow-button ${isFollowing ? 'room-follow-button-active' : ''}`}
                      onClick={handleFollowToggle}
                    >
                      {isFollowing ? 'Siguiendo' : 'Seguir'}
                    </button>
                  ) : (
                    <Link href="/login" className="btn btn-primary">
                      Entrar para seguir
                    </Link>
                  )}

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handlePrivateShortcut}
                    disabled={!isLive || tipping}
                  >
                    {canEnterPrivateRoom ? '🎥 Entrar al privado' : user ? '🔒 Reservar privado' : '🔐 Entrar para reservar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card room-sidebar-card">
              <span className="page-kicker">💎 Tokens rápidos</span>
              <h3>Resumen del canal</h3>
              <div className="credit-grid compact-grid">
                <div className="credit-card">
                  <span>Saldo</span>
                  <strong className="credit-value">{user ? formatCount(user.credits || 0) : '0'}</strong>
                </div>
                <div className="credit-card">
                  <span>Meta</span>
                  <strong className="credit-value">{formatCount(tipGoalProgress)} / {formatCount(TIP_GOAL_TOTAL)}</strong>
                </div>
                <div className="credit-card">
                  <span>Mayor</span>
                  <strong className="credit-value">{formatCount(largestTip.amount)}</strong>
                </div>
                <div className="credit-card">
                  <span>Última</span>
                  <strong className="credit-value">{formatCount(lastTip.amount)}</strong>
                </div>
              </div>
              <div className="room-progress">
                <div className="room-progress-track">
                  <div
                    className="room-progress-fill"
                    style={{ width: `${Math.min(100, Math.round((tipGoalProgress / TIP_GOAL_TOTAL) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="card room-sidebar-card">
              <div className="section-heading">
                <div>
              <span className="page-kicker">🧭 Más salas</span>
                  <h3>Descubrimiento rápido</h3>
                </div>
                <span className="info-chip">{visibleDiscoveryRooms.length}</span>
              </div>

              <div className="profile-list">
                {visibleDiscoveryRooms.slice(0, 3).length === 0 ? (
                  <div className="profile-empty-box">
                    No hay salas que coincidan con esta búsqueda.
                  </div>
                ) : (
                  visibleDiscoveryRooms.slice(0, 3).map((room) => (
                    <Link key={`side-${room.id}`} href={room.href} className="profile-list-item">
                      {room.title} · {room.country} · {formatCount(room.viewers)} viewers
                    </Link>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
