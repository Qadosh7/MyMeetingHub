import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting, Topic, Break, AgendaItem, TopicParticipant, Participant } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, GripVertical, Clock, 
  Users, User, Coffee, Save, ChevronDown, ChevronUp, ChevronRight, 
  Utensils, Mic, Presentation, MessageCircle, Play,
  Settings2, LayoutList, Share2, MoreHorizontal, Loader2, Sparkles,
  ChevronLeft, Tag as TagIcon, Calendar, History, Star, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { format, addMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SortableAgendaItemProps {
  key?: React.Key;
  id: string;
  item: AgendaItem;
  participants: TopicParticipant[];
  onDelete: (id: string, type: 'topic' | 'break') => void | Promise<void>;
  onUpdate: (id: string, type: 'topic' | 'break', updates: any) => void | Promise<void>;
  onAddParticipant: (topicId: string, participantId: string, name: string) => void | Promise<void>;
  onRemoveParticipant: (id: string) => void | Promise<void>;
  startTime: string | null | undefined;
  timing?: { start: string, end: string };
  globalParticipants: Participant[];
}

function SortableAgendaItem({ 
  id, item, participants, onDelete, onUpdate, 
  onAddParticipant, onRemoveParticipant,
  startTime, timing, globalParticipants
}: SortableAgendaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...item });
  const [newParticipant, setNewParticipant] = useState('');

  const isTopic = item.type === 'topic';
  const itemParticipants = isTopic ? participants.filter(p => p.topic_id === item.id) : [];

  const handleSave = () => {
    onUpdate(item.id, item.type, {
      title: editData.title,
      duration_minutes: Math.max(1, Number(editData.duration_minutes)),
      ...(isTopic ? { 
        presenter_id: (editData as Topic).presenter_id,
        presenter_name: (editData as Topic).presenter_name 
      } : {})
    });
    setIsEditing(false);
  };

  const adjustTime = (amount: number) => {
    const newTime = Math.max(1, item.duration_minutes + amount);
    onUpdate(item.id, item.type, { duration_minutes: newTime });
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={isDragging ? 'z-50 ring-2 ring-primary/50' : ''}
    >
      <div 
        className={`group relative flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-card border transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/[0.02] ${
          !isTopic ? 'bg-muted/30 border-dashed' : 'border-border'
        }`}
      >
        {/* Left Section: Drag & Icon */}
        <div className="flex items-center gap-4">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab p-1.5 rounded-lg text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted transition-colors transition-transform active:scale-95"
          >
            <GripVertical size={18} />
          </div>

          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isTopic 
              ? 'bg-primary/10 text-primary border-primary/20' 
              : 'bg-muted text-muted-foreground border-border'
          }`}>
            {isTopic ? (
               <Mic size={20} />
            ) : (
               <Coffee size={20} />
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-4 py-1">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  value={editData.title} 
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  className="h-10 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                  placeholder="Título do item"
                  autoFocus
                />
                {isTopic && (
                  <div className="relative flex-1">
                    <Input 
                      value={(editData as Topic).presenter_name || ''} 
                      onChange={(e) => {
                        const name = e.target.value;
                        setEditData({...editData, presenter_name: name});
                      }}
                      className="h-10 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                      placeholder="Responsável (Apresentador)"
                      list={`presenters-${id}`}
                    />
                    <datalist id={`presenters-${id}`}>
                      {globalParticipants.map(gp => (
                        <option key={gp.id} value={gp.name} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                   <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Minutos</Label>
                   <Input 
                    type="number"
                    value={editData.duration_minutes} 
                    onChange={(e) => setEditData({...editData, duration_minutes: Number(e.target.value)})}
                    className="h-10 w-24 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                  />
                 </div>
                 <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="rounded-xl h-10 px-4" onClick={() => setIsEditing(false)}>Cancelar</Button>
                   <Button size="sm" className="rounded-xl h-10 px-6 font-bold" onClick={handleSave}>Salvar</Button>
                 </div>
              </div>
            </div>
          ) : (
            <div 
              className="cursor-pointer group/title flex flex-col h-full justify-center"
              onClick={() => { setIsEditing(true); setEditData({ ...item }); }}
            >
              <div className="flex items-baseline gap-2">
                <h4 className={`font-bold text-lg tracking-tight transition-colors truncate ${
                  isTopic ? 'text-foreground' : 'text-muted-foreground font-medium'
                }`}>
                  {timing && (
                    <span className="mr-3 text-primary font-mono text-sm opacity-60">
                      {timing.start} - {timing.end}
                    </span>
                  )}
                  {item.title}
                </h4>
                {!isTopic && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 py-0.5 rounded-full border border-border/50">Intervalo</span>}
              </div>
              
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2">
                {isTopic && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Presentation size={14} className="text-primary/60" />
                    {(item as Topic).presenter_name || <span className="text-muted-foreground/40 italic">Sem apresentador</span>}
                  </div>
                )}
                
                {isTopic && itemParticipants.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users size={14} className="text-muted-foreground/60 mr-1" />
                    <div className="flex -space-x-2">
                      {itemParticipants.slice(0, 3).map(p => (
                        <div key={p.id} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-bold ring-1 ring-border/30">
                          {p.participant_name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {itemParticipants.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[8px] font-bold text-primary ring-1 ring-border/30">
                          +{itemParticipants.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Time & Actions */}
        <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-4 sm:border-l sm:pl-8 sm:min-w-[120px]">
          <div className="flex items-center gap-1 order-2 sm:order-1">
            <button 
              onClick={(e) => { e.stopPropagation(); adjustTime(-5); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all active:scale-90"
              title="-5 min"
            >
              <ChevronDown size={18} />
            </button>
            <div className="flex flex-col items-center px-3 min-w-[60px]">
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/30 leading-none mb-1">Dur</span>
              <span className="text-base font-mono font-bold tabular-nums">{item.duration_minutes}m</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); adjustTime(5); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all active:scale-90"
              title="+5 min"
            >
              <ChevronUp size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 order-1 sm:order-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
              onClick={() => onDelete(item.id, item.type)}
            >
              <Trash2 size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted transition-all"
              onClick={() => setIsEditing(true)}
            >
              <Settings2 size={16} />
            </Button>
          </div>
        </div>

        {/* Inline Add Participant (Bottom Overlay for topics) */}
        {isTopic && !isEditing && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm border border-border/50 rounded-full h-8 px-3 flex items-center gap-2 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
             <Users size={12} className="text-primary/60" />
             <input 
              placeholder="Adicionar pessoa..." 
              className="bg-transparent border-none outline-none text-[10px] w-24 placeholder:text-muted-foreground/40 font-medium"
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              list={`all-participants-${id}`}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newParticipant.trim()) {
                  // This is a bit tricky since ensureGlobalParticipant is in the parent.
                  // I'll assume for now SortableAgendaItem can't easily call it unless passed.
                  // I'll just pass the name and handle it in the parent or use a simple hack.
                  // BETTER: I'll just change the prop onAddParticipant to handle name search/creation.
                  onAddParticipant(id, '', newParticipant); // Using name as priority
                  setNewParticipant('');
                }
              }}
            />
            <datalist id={`all-participants-${id}`}>
              {globalParticipants.map(gp => (
                <option key={gp.id} value={gp.name} />
              ))}
            </datalist>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [globalParticipants, setGlobalParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [newTag, setNewTag] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id]);

  const toggleFavorite = async () => {
    if (!meeting) return;
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ is_favorite: !meeting.is_favorite })
        .eq('id', id);

      if (error) throw error;
      setMeeting({ ...meeting, is_favorite: !meeting.is_favorite });
      toast.success(meeting.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const addTag = async () => {
    if (!newTag.trim() || !meeting) return;
    const currentTags = meeting.tags || [];
    if (currentTags.includes(newTag.trim())) {
      setNewTag('');
      return;
    }
    const updatedTags = [...currentTags, newTag.trim()];
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ tags: updatedTags })
        .eq('id', id);

      if (error) throw error;
      setMeeting({ ...meeting, tags: updatedTags });
      setNewTag('');
    } catch (error) {
      toast.error('Erro ao adicionar tag');
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!meeting) return;
    const updatedTags = (meeting.tags || []).filter(t => t !== tagToRemove);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ tags: updatedTags })
        .eq('id', id);

      if (error) throw error;
      setMeeting({ ...meeting, tags: updatedTags });
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  };

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      const { data: meetingData, error: mError } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (mError) throw mError;
      setMeeting(meetingData);
      setTitleInput(meetingData.title);

      const { data: gParts, error: geError } = await supabase.from('participants').select('*');
      if (!geError) setGlobalParticipants(gParts || []);

      const { data: topics, error: tError } = await supabase.from('topics').select('*').eq('meeting_id', id);
      if (tError) throw tError;

      const { data: breaks, error: bError } = await supabase.from('breaks').select('*').eq('meeting_id', id);
      if (bError) throw bError;

      const topicIds = topics?.map(t => t.id) || [];
      const { data: parts, error: pError } = await supabase
        .from('topic_participants')
        .select('*')
        .in('topic_id', topicIds);
      if (pError) throw pError;
      setParticipants(parts || []);

      const merged: AgendaItem[] = [
        ...(topics || []).map(t => ({ ...t, type: 'topic' as const })),
        ...(breaks || []).map(b => ({ ...b, type: 'break' as const }))
      ].sort((a, b) => a.order_index - b.order_index);

      setItems(merged);
    } catch (error: any) {
      toast.error('Erro ao carregar reunião.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = () => items.reduce((acc, item) => acc + item.duration_minutes, 0);

  const itemTimings = useMemo(() => {
    if (!meeting?.start_time || items.length === 0) return [];
    
    let currentTime = parseISO(meeting.start_time);
    return items.map(item => {
      const start = format(currentTime, 'HH:mm');
      currentTime = addMinutes(currentTime, item.duration_minutes);
      const end = format(currentTime, 'HH:mm');
      return { start, end };
    });
  }, [meeting?.start_time, items]);

  const updateStartTime = async (newStartTime: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ start_time: newStartTime })
        .eq('id', id);
      if (error) throw error;
      setMeeting(prev => prev ? { ...prev, start_time: newStartTime } : null);
      toast.success('Horário de início atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar horário');
    }
  };

  const updateMeetingDate = async (newDate: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ event_date: newDate })
        .eq('id', id);
      if (error) throw error;
      setMeeting(prev => prev ? { ...prev, event_date: newDate } : null);
      toast.success('Data atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar data');
    }
  };

  const updateMeetingTitle = async () => {
    if (!titleInput.trim() || titleInput === meeting?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          title: titleInput,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      setMeeting({ ...meeting!, title: titleInput });
      setIsEditingTitle(false);
      toast.success('Título atualizado');
    } catch (error: any) {
      toast.error('Erro ao atualizar título');
    }
  };

  const addItem = async (type: 'topic' | 'break', customTitle?: string, customDuration?: number) => {
    const nextIndex = items.length;
    const body = {
      meeting_id: id,
      title: customTitle || (type === 'topic' ? 'Novo Tópico' : 'Intervalo'),
      duration_minutes: customDuration || (type === 'topic' ? 15 : 10),
      order_index: nextIndex
    };

    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { data, error } = await supabase.from(dbTable).insert([body]).select();
      if (error) throw error;
      
      const newItem = { ...data[0], type } as AgendaItem;
      setItems(prev => [...prev, newItem]);
    } catch (error: any) {
      toast.error('Erro ao adicionar item');
    }
  };

  const deleteItem = async (itemId: string, type: 'topic' | 'break') => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      await supabase.from(dbTable).delete().eq('id', itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success('Item removido');
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };

  const updateItem = async (itemId: string, type: 'topic' | 'break', updates: any) => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      
      // Handle presenter logic if table exists
      if (type === 'topic' && updates.presenter_name && !updates.presenter_id) {
        const global = await ensureGlobalParticipant(updates.presenter_name);
        if (global) {
          updates.presenter_id = global.id;
          updates.presenter_name = global.name;
        }
      }

      const { error } = await supabase.from(dbTable).update(updates).eq('id', itemId);
      
      // Fallback if columns are missing
      if (error && error.message.includes('column') && error.message.includes('not found')) {
        const fallbackUpdates = { ...updates };
        if (type === 'topic') {
          delete fallbackUpdates.presenter_id;
          delete fallbackUpdates.presenter_name;
          // Note: In original schema it was just 'presenter'
        }
        await supabase.from(dbTable).update(fallbackUpdates).eq('id', itemId);
      } else if (error) throw error;

      setItems(items.map(item => item.id === itemId ? { ...item, ...updates } : item));
      toast.success('Agenda atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar item');
    }
  };

  const addParticipant = async (topicId: string, participantId: string, name: string) => {
    try {
      let pId = participantId;
      let pName = name;

      if (!pId && pName) {
        const global = await ensureGlobalParticipant(pName);
        if (global) {
          pId = global.id;
          pName = global.name;
        }
      }

      const payload: any = { 
        topic_id: topicId, 
        participant_name: pName 
      };
      
      if (pId) payload.participant_id = pId;

      let { data, error } = await supabase.from('topic_participants').insert([payload]).select();
      
      // Fallback if participant_id column missing
      if (error && error.message.includes('participant_id') && error.message.includes('not found')) {
        delete payload.participant_id;
        const fallback = await supabase.from('topic_participants').insert([payload]).select();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      setParticipants(prev => [...prev, data[0]]);
    } catch (error) {
      toast.error('Erro ao adicionar participante ao tópico');
    }
  };

  const ensureGlobalParticipant = async (name: string): Promise<Participant | null> => {
    if (!user) return null;
    const existing = globalParticipants.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    try {
      const { data, error } = await supabase
        .from('participants')
        .insert([{ name, user_id: user.id }])
        .select()
        .single();
      if (error) {
        // If table doesn't exist, just treat as transient and return null
        if (error.message.includes('not found') || error.code === 'PGRST116') return null;
        throw error;
      }
      setGlobalParticipants(prev => [...prev, data]);
      return data;
    } catch {
      // Quietly fail for global participants if schema not ready
      return null;
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      await supabase.from('topic_participants').delete().eq('id', participantId);
      setParticipants(participants.filter(p => p.id !== participantId));
    } catch (error) {
      toast.error('Erro ao remover participante');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newArray = arrayMove(items, oldIndex, newIndex);
      setItems(newArray);
      try {
        const updates = newArray.map((item: AgendaItem, index: number) => {
          const dbTable = item.type === 'topic' ? 'topics' : 'breaks';
          return supabase.from(dbTable).update({ order_index: index }).eq('id', item.id);
        });
        await Promise.all(updates);
      } catch (error) {
        toast.error('Erro ao salvar nova ordem');
      }
    }
  };

  if (loading && !meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMin = calculateTotalTime();

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      {/* SaaS Breadcrumbs & Actions Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <History size={16} /> Dashboard
            </Link>
            <ChevronRight size={14} className="text-muted-foreground/30" />
            <span className="text-foreground font-bold truncate max-w-[200px]">{meeting?.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-xl h-10 w-10 transition-all ${meeting?.is_favorite ? 'text-amber-500 hover:bg-amber-50' : 'text-muted-foreground'}`}
              onClick={toggleFavorite}
            >
              <Star size={20} className={meeting?.is_favorite ? 'fill-current' : ''} />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground">
              <Share2 size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground">
              <MoreHorizontal size={18} />
            </Button>
          </div>
        </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              {meeting?.status === 'completed' ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Concluída
                </Badge>
              ) : meeting?.status === 'in_progress' ? (
                <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border-sky-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Em Execução
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Planejamento
                </Badge>
              )}
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-border/50">
                <Calendar size={12} className="text-muted-foreground" />
                <input 
                  type="date" 
                  value={meeting?.event_date || ''}
                  onChange={(e) => updateMeetingDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none focus:text-primary transition-colors cursor-pointer"
                  title="Data da Reunião"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full border border-border/50">
                <Clock size={12} className="text-muted-foreground" />
                <input 
                  type="time" 
                  value={meeting?.start_time ? format(parseISO(meeting.start_time), 'HH:mm') : ''}
                  onChange={(e) => {
                    const time = e.target.value;
                    if (time) {
                      const date = meeting?.start_time ? parseISO(meeting.start_time) : new Date();
                      const [hours, minutes] = time.split(':');
                      date.setHours(parseInt(hours), parseInt(minutes));
                      updateStartTime(date.toISOString());
                    }
                  }}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none focus:text-primary transition-colors cursor-pointer"
                  title="Horário de Início"
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hidden md:flex items-center gap-2">
                <History size={12} />
                Criada em {new Date(meeting?.created_at || '').toLocaleDateString('pt-BR')}
              </span>
            </div>
            
            <AnimatePresence mode="wait">
              {isEditingTitle ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <Input 
                    value={titleInput} 
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={updateMeetingTitle}
                    onKeyDown={(e) => e.key === 'Enter' && updateMeetingTitle()}
                    autoFocus
                    className="h-14 text-4xl font-black tracking-tight bg-transparent border-none p-0 focus-visible:ring-0 shadow-none"
                  />
                </motion.div>
              ) : (
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-4xl lg:text-5xl font-black tracking-tight cursor-text hover:text-primary transition-colors leading-tight"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {meeting?.title}
                </motion.h1>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 h-fit">
            <Button 
              className="rounded-full h-14 px-10 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all bg-primary hover:bg-primary/90"
              onClick={() => navigate(`/meeting/${id}/run`)}
            >
              <Play size={20} className="mr-3 fill-current" />
              Executar Reunião
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Main Agenda Section (8/12) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                Agenda do Dia
              </h2>
              <Badge variant="outline" className="rounded-full px-3 py-0.5 font-bold tabular-nums">
                {items.length} Itens
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <div className="flex p-1 bg-muted/40 rounded-2xl border border-border/30">
                <Button onClick={() => addItem('topic')} variant="ghost" size="sm" className="rounded-xl h-9 text-xs font-bold gap-2 px-4 hover:bg-background hover:shadow-sm transition-all">
                  <Plus size={16} /> Tópico
                </Button>
                <Button onClick={() => addItem('break')} variant="ghost" size="sm" className="rounded-xl h-9 text-xs font-bold gap-2 px-4 hover:bg-background hover:shadow-sm transition-all">
                  <Plus size={16} /> Pausa
                </Button>
              </div>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {items.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-32 bg-card/40 border-2 border-dashed border-border/50 rounded-[3rem] flex flex-col items-center justify-center space-y-6"
                  >
                    <div className="h-20 w-20 rounded-[2rem] bg-muted/30 flex items-center justify-center border border-border/50 shadow-inner">
                      <LayoutList className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold">Agenda Vazia</h3>
                      <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
                        Você ainda não adicionou nenhum tópico para esta reunião. Comece organizando os pontos principais.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  items.map((item: AgendaItem, index: number) => (
                    <SortableAgendaItem
                      key={item.id}
                      id={item.id}
                      item={item}
                      participants={participants}
                      onDelete={deleteItem}
                      onUpdate={updateItem}
                      onAddParticipant={addParticipant}
                      onRemoveParticipant={removeParticipant}
                      startTime={meeting?.start_time}
                      timing={itemTimings[index]}
                      globalParticipants={globalParticipants}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Sidebar Context (4/12) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-8 space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-card border border-border/50 rounded-[2rem] space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tempo Total</p>
                <p className="text-3xl font-mono font-black tabular-nums">{totalMin}m</p>
              </div>
              <div className="p-6 bg-card border border-border/50 rounded-[2rem] space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tópicos</p>
                <p className="text-3xl font-mono font-black tabular-nums">{items.filter(i => i.type === 'topic').length}</p>
              </div>
            </div>

            {/* Tag Management */}
            <div className="p-8 bg-card border border-border/50 rounded-[2.5rem] space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <TagIcon size={14} /> Categorias & Tags
              </h3>

              <div className="flex flex-wrap gap-2">
                {meeting?.tags?.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="rounded-full px-3 py-1 font-bold group border border-border transition-all"
                  >
                    {tag}
                    <button 
                      onClick={() => removeTag(tag)}
                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))}
                <div className="relative group/tag">
                   <Input 
                    placeholder="+ Adicionar tag..."
                    className="h-8 rounded-full bg-muted/30 border-dashed border-border/50 text-[10px] font-bold px-4 w-32 focus:w-full transition-all focus:bg-background"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                   />
                </div>
              </div>
            </div>

            {/* Participants Summary */}
            <div className="p-8 bg-card border border-border/50 rounded-[2.5rem] space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Users size={14} /> Participantes ({new Set(participants.map(p => p.participant_name)).size})
              </h3>
              
              <div className="space-y-4">
                <div className="flex -space-x-3 overflow-hidden">
                  {Array.from(new Set(participants.map(p => p.participant_name))).slice(0, 8).map((name: any, i) => (
                    <div 
                      key={i} 
                      className="inline-block h-10 w-10 rounded-full ring-4 ring-card bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary shadow-sm hover:-translate-y-1 transition-transform"
                      title={name}
                    >
                      {String(name).charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {new Set(participants.map(p => p.participant_name)).size > 8 && (
                    <div className="inline-block h-10 w-10 rounded-full ring-4 ring-card bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-sm">
                      +{new Set(participants.map(p => p.participant_name)).size - 8}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">
                  Os participantes são associados a cada tópico específico da agenda durante o planejamento.
                </p>
              </div>
            </div>

            {/* Smart Insights */}
            <div className="p-8 bg-primary/5 border border-primary/10 rounded-[2.5rem] space-y-4 relative overflow-hidden group">
               <div className="absolute -right-6 -top-6 text-primary/5 group-hover:scale-125 transition-transform duration-700">
                  <Sparkles size={160} />
               </div>
               <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Sparkles size={24} />
               </div>
               <div className="space-y-2 relative z-10">
                  <h4 className="text-sm font-black text-primary uppercase tracking-widest">Insights do Planner</h4>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {totalMin > 60 ? "Esta reunião ultrapassa 1 hora. Considere pausas curtas a cada 45 minutos para manter o foco." : 
                     items.length < 3 ? "Agendas com poucos tópicos tendem a ser mais produtivas. Foque nos itens essenciais." : 
                     "Lembre-se de reservar os 5 minutos finais para definir os próximos passos e responsáveis."}
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}

