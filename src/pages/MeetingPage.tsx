import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting, Topic, Break, AgendaItem, TopicParticipant } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  ArrowLeft, Plus, Trash2, GripVertical, Clock, 
  Users, User, Coffee, Save, CheckCircle2, ChevronDown, ChevronUp, 
  Utensils, Mic, Presentation, MessageCircle, Play
} from 'lucide-react';

// DND Kit imports
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

interface SortableAgendaItemProps {
  key?: string;
  id: string;
  item: AgendaItem;
  participants: TopicParticipant[];
  onDelete: (id: string, type: 'topic' | 'break') => void | Promise<void>;
  onUpdate: (id: string, type: 'topic' | 'break', updates: any) => void | Promise<void>;
  onAddParticipant: (topicId: string, name: string) => void | Promise<void>;
  onRemoveParticipant: (id: string) => void | Promise<void>;
}

function SortableAgendaItem({ 
  id, item, participants, onDelete, onUpdate, 
  onAddParticipant, onRemoveParticipant 
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
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
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
      ...(isTopic ? { presenter: (editData as Topic).presenter } : {})
    });
    setIsEditing(false);
  };

  const adjustTime = (amount: number) => {
    const newTime = Math.max(1, item.duration_minutes + amount);
    onUpdate(item.id, item.type, { duration_minutes: newTime });
  };

  return (
    <div ref={setNodeRef} style={style} className={`mb-4 ${isDragging ? 'grabbing' : ''}`}>
      <div className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm transition-all bg-white overflow-hidden relative ${
        isTopic ? 'border-slate-200 hover:border-indigo-200' : 'bg-amber-50/50 border-amber-200 border-dashed hover:border-amber-400'
      }`}>
        <div {...attributes} {...listeners} className={`cursor-grab shrink-0 transition-colors p-1 rounded hover:bg-slate-50 ${
          isTopic ? 'text-slate-300 hover:text-slate-500' : 'text-amber-300 hover:text-amber-500'
        }`}>
          ⠿
        </div>

        {isTopic ? (
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold shrink-0">
            {String(item.order_index + 1).padStart(2, '0')}
          </div>
        ) : (
          <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center text-amber-700 shrink-0">
            <Coffee size={20} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input 
                  value={editData.title} 
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  className="h-8 text-sm"
                  placeholder="Título"
                />
                {isTopic && (
                  <Input 
                    value={(editData as Topic).presenter || ''} 
                    onChange={(e) => setEditData({...editData, presenter: e.target.value})}
                    className="h-8 text-sm"
                    placeholder="Nome do apresentador"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  value={editData.duration_minutes} 
                  onChange={(e) => setEditData({...editData, duration_minutes: Number(e.target.value)})}
                  className="h-8 w-20 text-sm"
                  min="1"
                />
                <span className="text-xs text-slate-400">minutos</span>
                <div className="flex-1" />
                <Button size="sm" className="h-7 text-xs bg-indigo-600" onClick={handleSave}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div onClick={() => { setIsEditing(true); setEditData({ ...item }); }} className="cursor-pointer group/title">
              <h4 className={`font-semibold truncate transition-colors ${
                isTopic ? 'text-slate-800' : 'text-amber-800 uppercase text-xs tracking-widest'
              }`}>
                {item.title}
              </h4>
              <div className="flex items-center gap-4 mt-0.5">
                {isTopic && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <User size={12} className="text-slate-400" />
                    {(item as Topic).presenter || <span className="text-slate-400 italic">Definir responsável</span>}
                  </p>
                )}
                {isTopic && (
                  <p className="text-[10px] text-indigo-400 opacity-0 group-hover/title:opacity-100 transition-opacity uppercase font-bold">
                    Clique para editar
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0 px-2 lg:px-4">
          <div className="flex flex-col items-center gap-1 group/time">
            <div className="flex items-center gap-1 opacity-0 group-hover/time:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); adjustTime(-10); }}
                className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                title="-10 min"
              >
                <ChevronDown size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); adjustTime(10); }}
                className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                title="+10 min"
              >
                <ChevronUp size={14} />
              </button>
            </div>
            <div className="text-right">
              <p className={`text-[10px] uppercase font-bold tracking-widest ${isTopic ? 'text-slate-400' : 'text-amber-600 opacity-60'}`}>Duração</p>
              <p className={`text-sm font-mono font-semibold ${isTopic ? 'text-slate-700' : 'text-amber-800'}`}>{item.duration_minutes}m</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
           <Button 
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 transition-colors ${isTopic ? 'text-slate-200 hover:text-red-500' : 'text-amber-200 hover:text-amber-600'}`} 
            onClick={() => onDelete(item.id, item.type)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      
      {isTopic && (
         <div className="ml-14 mt-1 flex flex-wrap items-center gap-2">
            {itemParticipants.map(participant => (
              <div key={participant.id} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm">
                {participant.participant_name}
                <button onClick={() => onRemoveParticipant(participant.id)} className="hover:text-red-500 transition-colors">
                  <Plus className="rotate-45" size={10} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-1 opacity-40 hover:opacity-100 transition-opacity">
               <Input 
                placeholder="+ participante" 
                className="h-5 w-24 text-[9px] bg-transparent border-none p-0 focus-visible:ring-0"
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newParticipant.trim()) {
                    onAddParticipant(id, newParticipant);
                    setNewParticipant('');
                  }
                }}
              />
            </div>
         </div>
      )}
    </div>
  );
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id]);

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      // 1. Fetch meeting
      const { data: meetingData, error: mError } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (mError) throw mError;
      setMeeting(meetingData);
      setTitleInput(meetingData.title);

      // 2. Fetch topics
      const { data: topics, error: tError } = await supabase.from('topics').select('*').eq('meeting_id', id);
      if (tError) throw tError;

      // 3. Fetch breaks
      const { data: breaks, error: bError } = await supabase.from('breaks').select('*').eq('meeting_id', id);
      if (bError) throw bError;

      // 4. Fetch participants (for all topics in this meeting)
      const topicIds = topics?.map(t => t.id) || [];
      const { data: parts, error: pError } = await supabase
        .from('topic_participants')
        .select('*')
        .in('topic_id', topicIds);
      if (pError) throw pError;
      setParticipants(parts || []);

      // 5. Merge and sort
      const merged: AgendaItem[] = [
        ...(topics || []).map(t => ({ ...t, type: 'topic' as const })),
        ...(breaks || []).map(b => ({ ...b, type: 'break' as const }))
      ].sort((a, b) => a.order_index - b.order_index);

      setItems(merged);
    } catch (error: any) {
      console.error('Detailed error in fetchMeetingData:', error);
      toast.error('Erro ao carregar dados da reunião: ' + (error.message || ''));
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = () => {
    return items.reduce((acc, item) => acc + item.duration_minutes, 0);
  };

  const updateMeetingTitle = async () => {
    if (!titleInput.trim() || titleInput === meeting?.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const { error } = await supabase.from('meetings').update({ title: titleInput }).eq('id', id);
      if (error) throw error;
      setMeeting({ ...meeting!, title: titleInput });
      setIsEditingTitle(false);
      toast.success('Título atualizado');
    } catch (error: any) {
      console.error('Error updating meeting title:', error);
      toast.error('Erro ao atualizar título: ' + (error.message || ''));
    }
  };

  const addItem = async (type: 'topic' | 'break', customTitle?: string, customDuration?: number) => {
    const nextIndex = items.length;
    const body = {
      meeting_id: id,
      title: customTitle || (type === 'topic' ? 'Novo Tópico' : 'Pausa'),
      duration_minutes: customDuration || (type === 'topic' ? 15 : 10),
      order_index: nextIndex
    };

    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { data, error } = await supabase
        .from(dbTable)
        .insert([body])
        .select();

      if (error) {
        console.error(`Erro ao adicionar ${type}:`, error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Item inserido, mas não retornado. Verifique se você é o dono desta reunião.');
      }
      
      const newItem = { ...data[0], type } as AgendaItem;
      setItems(prev => [...prev, newItem]);
      toast.success(`${newItem.title} adicionado`);
    } catch (error: any) {
      console.error('Catch error ao adicionar item:', error);
      toast.error('Erro ao adicionar item: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const deleteItem = async (itemId: string, type: 'topic' | 'break') => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { error } = await supabase.from(dbTable).delete().eq('id', itemId);
      if (error) throw error;

      setItems(items.filter(item => item.id !== itemId));
      toast.success('Item removido');
    } catch (error: any) {
      toast.error('Erro ao remover item');
    }
  };

  const updateItem = async (itemId: string, type: 'topic' | 'break', updates: any) => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { error } = await supabase.from(dbTable).update(updates).eq('id', itemId);
      if (error) {
        console.error(`Supabase error updating ${type}:`, error);
        throw error;
      }

      setItems(items.map(item => item.id === itemId ? { ...item, ...updates } : item));
      toast.success('Item atualizado');
    } catch (error: any) {
      console.error('Catch error updating item:', error);
      toast.error('Erro ao atualizar item: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const addParticipant = async (topicId: string, name: string) => {
    try {
      const { data, error } = await supabase
        .from('topic_participants')
        .insert([{ topic_id: topicId, participant_name: name }])
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Não foi possível salvar o participante.');
      
      setParticipants(prev => [...prev, data[0]]);
    } catch (error: any) {
      console.error('Erro ao adicionar participante:', error);
      toast.error('Erro ao adicionar participante: ' + (error.message || ''));
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase.from('topic_participants').delete().eq('id', participantId);
      if (error) throw error;
      setParticipants(participants.filter(p => p.id !== participantId));
    } catch (error: any) {
      toast.error('Erro ao remover participante');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      
      const newArray = arrayMove(items, oldIndex, newIndex);
      
      // Update local state first for instant feedback
      setItems(newArray);

      // Async update database - update ALL indices to be safe
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

  const totalMinutes = calculateTotalTime();
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (loading && !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-slate-500 font-medium animate-pulse">Carregando reunião...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-lg hover:bg-slate-50 mr-2">
            <ArrowLeft size={18} />
          </Button>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <h1 className="font-semibold text-lg tracking-tight hidden sm:block">Agenda Inteligente</h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Tempo Total</span>
            <span className="text-xl font-mono font-medium text-indigo-600">
              {String(totalHours).padStart(2, '0')}:{String(remainingMinutes).padStart(2, '0')}:00
            </span>
          </div>
          <Button 
            size="sm" 
            className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 gap-2 px-5" 
            onClick={() => navigate(`/meeting/${id}/run`)}
          >
            <Play size={16} fill="currentColor" />
            Iniciar Reunião
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Planejamento da Pauta</span>
              {isEditingTitle ? (
                <Input 
                  value={titleInput} 
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={updateMeetingTitle}
                  onKeyDown={(e) => e.key === 'Enter' && updateMeetingTitle()}
                  autoFocus
                  className="h-10 text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-slate-200"
                />
              ) : (
                <h2 
                  className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {meeting?.title}
                </h2>
              )}
            </div>
            <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
               <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => addItem('break', 'Pausa', 15)}
                className="text-slate-600 hover:text-amber-600 hover:bg-amber-50 h-8 gap-1.5"
              >
                <Plus size={14} /> Pausa
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => addItem('topic')}
                className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 h-8 gap-1.5"
              >
                <Plus size={14} /> Tópico
              </Button>
            </div>
          </div>

          {/* Quick Add Bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 rounded-2xl">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mr-2">Adição Rápida</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-white hover:bg-slate-800 gap-2 text-xs font-semibold"
              onClick={() => addItem('topic', 'Introdução', 5)}
            >
              <Mic size={14} className="text-indigo-400" /> Introdução
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-white hover:bg-slate-800 gap-2 text-xs font-semibold"
              onClick={() => addItem('topic', 'Apresentação', 20)}
            >
              <Presentation size={14} className="text-emerald-400" /> Apresentação
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-white hover:bg-slate-800 gap-2 text-xs font-semibold"
              onClick={() => addItem('topic', 'Discussão', 15)}
            >
              <MessageCircle size={14} className="text-sky-400" /> Discussão
            </Button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-white hover:bg-slate-800 gap-2 text-xs font-semibold"
              onClick={() => addItem('break', 'Pausa para Café', 15)}
            >
              <Coffee size={14} className="text-amber-400" /> Café
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-white hover:bg-slate-800 gap-2 text-xs font-semibold"
              onClick={() => addItem('break', 'Almoço', 60)}
            >
              <Utensils size={14} className="text-rose-400" /> Almoço
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.length === 0 ? (
                  <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-3xl">
                     <p className="text-slate-400 font-medium">A agenda ainda está vazia.</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <SortableAgendaItem
                      key={item.id}
                      id={item.id}
                      item={item}
                      participants={participants}
                      onDelete={deleteItem}
                      onUpdate={updateItem}
                      onAddParticipant={addParticipant}
                      onRemoveParticipant={removeParticipant}
                    />
                  ))
                )}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <aside className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-8 overflow-y-auto hidden xl:flex">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Resumo da Sessão</h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Tópicos</span>
                <span className="font-bold">{items.filter(i => i.type === 'topic').length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Pausas</span>
                <span className="font-bold">{items.filter(i => i.type === 'break').length}</span>
              </div>
              <div className="h-px bg-slate-200 my-1"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Total Est.</span>
                <span className="text-sm font-mono font-bold text-indigo-600">{totalMinutes} min</span>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-lg shadow-indigo-100">
              <p className="text-xs font-medium opacity-80 mb-2 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5 leading-none">
                <Users size={12} /> Dica Inteligente
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                {items.length > 3 ? 'Divida a reunião em blocos produtivos com pausas a cada 45 minutos.' : 'Uma agenda curta e objetiva garante maior engajamento dos membros.'}
              </p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
