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
  Users, User, Coffee, Save, CheckCircle2, ChevronDown, ChevronUp 
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
      duration_minutes: Number(editData.duration_minutes),
      ...(isTopic ? { presenter: (editData as Topic).presenter } : {})
    });
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className={`mb-3 ${isDragging ? 'grabbing' : ''}`}>
      <Card className={`group border-l-4 ${isTopic ? 'border-l-primary' : 'border-l-amber-400'} hover:shadow-md transition-shadow bg-white`}>
        <div className="flex p-4 gap-4">
          <div {...attributes} {...listeners} className="mt-1 text-slate-300 group-hover:text-slate-400 cursor-grab hover:text-primary active:cursor-grabbing transition-colors self-start shrink-0">
            <GripVertical size={20} />
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Título</label>
                    <Input 
                      value={editData.title} 
                      onChange={(e) => setEditData({...editData, title: e.target.value})}
                      placeholder="Título do item"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Duração (min)</label>
                    <Input 
                      type="number"
                      value={editData.duration_minutes} 
                      onChange={(e) => setEditData({...editData, duration_minutes: Number(e.target.value)})}
                      min="0"
                    />
                  </div>
                  {isTopic && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Apresentador</label>
                      <Input 
                        value={(editData as Topic).presenter || ''} 
                        onChange={(e) => setEditData({...editData, presenter: e.target.value})}
                        placeholder="Nome"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} className="gap-1.5">
                    <Save size={14} /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditData({...item}); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h3 
                      className="text-lg font-semibold text-slate-900 cursor-pointer hover:text-primary transition-colors truncate"
                      onClick={() => setIsEditing(true)}
                    >
                      {item.title}
                    </h3>
                    <Badge variant={isTopic ? 'default' : 'secondary'} className={isTopic ? '' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                      {isTopic ? 'Tópico' : 'Pausa'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                      <Clock size={16} />
                      {item.duration_minutes} min
                    </div>
                    {isTopic && (editData as Topic).presenter && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-md">
                        <User size={16} />
                        {(editData as Topic).presenter}
                      </div>
                    )}
                  </div>
                </div>

                {isTopic && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-widest mr-2">Participantes</span>
                    {itemParticipants.map(participant => (
                      <Badge key={participant.id} variant="outline" className="gap-1 pl-2 pr-1.5 py-1 border-slate-200">
                        {participant.name}
                        <button 
                          onClick={() => onRemoveParticipant(participant.id)}
                          className="p-0.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-destructive"
                        >
                          <Plus className="rotate-45" size={12} />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                      <Input 
                        placeholder="Adicionar..." 
                        className="h-7 w-28 text-xs bg-slate-50 border-dashed"
                        value={newParticipant}
                        onChange={(e) => setNewParticipant(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newParticipant.trim()) {
                            onAddParticipant(item.id, newParticipant);
                            setNewParticipant('');
                          }
                        }}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-slate-400"
                        onClick={() => {
                          if (newParticipant.trim()) {
                            onAddParticipant(item.id, newParticipant);
                            setNewParticipant('');
                          }
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity self-start">
             <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => onDelete(item.id, item.type)}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </Card>
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
      toast.error('Erro ao carregar dados da reunião');
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
      toast.error('Erro ao atualizar título');
    }
  };

  const addItem = async (type: 'topic' | 'break') => {
    const nextIndex = items.length;
    const body = {
      meeting_id: id,
      title: type === 'topic' ? 'Novo Tópico' : 'Pausa',
      duration_minutes: type === 'topic' ? 15 : 10,
      order_index: nextIndex
    };

    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { data, error } = await supabase.from(dbTable).insert([body]).select().single();
      if (error) throw error;
      
      const newItem = { ...data, type } as AgendaItem;
      setItems([...items, newItem]);
      toast.success(`${type === 'topic' ? 'Tópico' : 'Pausa'} adicionado`);
    } catch (error: any) {
      toast.error('Erro ao adicionar item');
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
      if (error) throw error;

      setItems(items.map(item => item.id === itemId ? { ...item, ...updates } : item));
      toast.success('Item atualizado');
    } catch (error: any) {
      toast.error('Erro ao atualizar item');
    }
  };

  const addParticipant = async (topicId: string, name: string) => {
    try {
      const { data, error } = await supabase.from('topic_participants').insert([{ topic_id: topicId, name }]).select().single();
      if (error) throw error;
      setParticipants([...participants, data]);
    } catch (error: any) {
      toast.error('Erro ao adicionar participante');
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
        // Revert? fetchMeetingData();
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={titleInput} 
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={updateMeetingTitle}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && updateMeetingTitle()}
                  className="h-9 min-w-[200px] font-bold text-lg"
                />
                <Button size="sm" onClick={updateMeetingTitle}>OK</Button>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setIsEditingTitle(true)}
              >
                <h1 className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">
                  {meeting?.title}
                </h1>
                <Badge variant="outline" className="hidden group-hover:inline-flex text-[10px] uppercase tracking-wider py-0 px-1 opacity-60">Editar</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Tempo Total</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
               <Clock size={16} className="text-primary" />
               {totalHours > 0 ? `${totalHours}h ` : ''}{remainingMinutes} min
            </div>
          </div>
          <Separator orientation="vertical" className="h-8 hidden sm:block" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addItem('break')} className="gap-1.5 border-amber-200 hover:bg-amber-50 hover:text-amber-700">
              <Coffee size={14} /> Pausa
            </Button>
            <Button size="sm" onClick={() => addItem('topic')} className="gap-1.5">
              <Plus size={14} /> Tópico
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
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
              <div className="text-center py-24 bg-white border border-dashed rounded-3xl space-y-6">
                <div className="inline-flex p-5 bg-primary/5 rounded-full text-primary/40 mb-2">
                  <CheckCircle2 size={56} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">A pauta está vazia</h3>
                  <p className="text-slate-500 mt-2 max-w-xs mx-auto">Comece adicionando tópicos de discussão ou pausas programadas.</p>
                </div>
                <div className="flex justify-center gap-3">
                   <Button variant="outline" onClick={() => addItem('topic')} className="gap-2">
                    <Plus size={18} /> Adicionar Tópico
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pb-24">
                {items.map((item) => (
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
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      </main>

      {/* Floating total time for mobile */}
      <div className="sm:hidden fixed bottom-6 left-6 right-6 z-30 pointer-events-none">
        <div className="bg-slate-900 text-white rounded-full px-6 py-4 shadow-xl flex items-center justify-between pointer-events-auto border border-slate-700">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/20 rounded-full">
               <Clock size={20} className="text-primary" />
             </div>
             <div>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duracão Total</p>
               <p className="font-bold text-lg leading-tight">
                 {totalHours > 0 ? `${totalHours}h ` : ''}{remainingMinutes} min
               </p>
             </div>
          </div>
          <Button size="icon" className="h-10 w-10 rounded-full" onClick={() => addItem('topic')}>
            <Plus size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
