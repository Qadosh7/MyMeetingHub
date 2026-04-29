import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting, Topic, Break, AgendaItem, TopicParticipant, Participant, MeetingParticipant } from '@/src/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, GripVertical, Clock, 
  Users, User, Coffee, Save, ChevronDown, ChevronUp, ChevronRight, 
  Utensils, Mic, Presentation, MessageCircle, Play,
  Settings2, LayoutList, Share2, MoreHorizontal, Loader2, Sparkles,
  ChevronLeft, Tag as TagIcon, Calendar, History, Star, X, Check, Search, UserPlus, Minus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  useDraggable
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
  meetingParticipants: MeetingParticipant[];
  onDelete: (id: string, type: 'topic' | 'break') => void | Promise<void>;
  onUpdate: (id: string, type: 'topic' | 'break', updates: any) => void | Promise<void>;
  onAddParticipant: (topicId: string, meetingParticipantId: string) => void | Promise<void>;
  onRemoveParticipant: (id: string) => void | Promise<void>;
  onToggleRole: (id: string, currentRole: 'required' | 'optional') => void | Promise<void>;
  startTime: string | null | undefined;
  timing?: { start: string, end: string };
  globalParticipants: Participant[];
}

interface DraggableParticipantProps {
  participant: MeetingParticipant;
  onRemove: (id: string) => void | Promise<void>;
}

const DraggableParticipant: React.FC<DraggableParticipantProps> = ({ participant, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `participant-${participant.id}`,
    data: { participant }
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between p-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
          {participant.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-[11px] font-bold text-foreground/80 truncate max-w-[120px]">{participant.name}</span>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(participant.id); }}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function SortableAgendaItem({ 
  id, item, participants, meetingParticipants, onDelete, onUpdate, 
  onAddParticipant, onRemoveParticipant, onToggleRole,
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

  const isTopic = item.type === 'topic';
  const itemParticipants = useMemo(() => {
    if (!isTopic) return [];
    return participants
      .filter(p => p.topic_id === item.id)
      .map(p => {
        const mp = meetingParticipants.find(mp => mp.id === p.meeting_participant_id);
        return { ...p, name: mp?.name || 'Unknown' };
      })
      .sort((a, b) => {
        if (a.role === 'required' && b.role === 'optional') return -1;
        if (a.role === 'optional' && b.role === 'required') return 1;
        return 0;
      });
  }, [isTopic, participants, meetingParticipants, item.id]);

  const isHighRisk = useMemo(() => {
    const requiredCount = itemParticipants.filter(p => p.role === 'required').length;
    return requiredCount > 5;
  }, [itemParticipants]);

  const { isOver: isOverPresenter, setNodeRef: presenterRef } = useDroppable({
    id: `presenter-${item.id}`,
    data: { role: 'presenter', topicId: item.id }
  });

  const { isOver: isOverRequired, setNodeRef: requiredRef } = useDroppable({
    id: `required-${item.id}`,
    data: { role: 'required', topicId: item.id }
  });

  const { isOver: isOverOptional, setNodeRef: optionalRef } = useDroppable({
    id: `optional-${item.id}`,
    data: { role: 'optional', topicId: item.id }
  });

  const handleSave = () => {
    onUpdate(item.id, item.type, {
      title: editData.title,
      duration_minutes: Math.max(1, Number(editData.duration_minutes)),
      ...(isTopic ? { 
        presenter_id: (editData as Topic).presenter_id || null,
        presenter_name: (editData as Topic).presenter_name || null
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
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          {isEditing ? (
            <div className="flex-1 space-y-4 py-1">
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center">
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Título do Tópico</Label>
                  <Input 
                    value={editData.title} 
                    onChange={(e) => setEditData({...editData, title: e.target.value})}
                    className="h-10 rounded-xl bg-muted/30 focus:bg-background border-border/50 text-sm font-bold"
                    placeholder="Ex: Alinhamento de Metas"
                    autoFocus
                  />
                </div>
                
                {isTopic && (
                  <div className="w-full xl:w-[280px] space-y-1.5 shrink-0">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Apresentador</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "w-full h-10 justify-between rounded-xl bg-muted/30 border-border/50 text-xs font-medium hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          { (editData as Topic).presenter_id ? (
                             <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-black text-primary border border-primary/20 shrink-0">
                               {(editData as Topic).presenter_name?.charAt(0).toUpperCase()}
                             </div>
                          ) : (
                             <User size={14} className="text-primary/60 shrink-0" />
                          )}
                          <span className="truncate">{(editData as Topic).presenter_name || 'Definir apresentador'}</span>
                        </div>
                        <ChevronDown size={14} className="opacity-40" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[240px] rounded-2xl p-2 shadow-2xl">
                        <DropdownMenuItem 
                          className="rounded-xl py-2 px-3 text-xs font-bold gap-2 text-muted-foreground"
                          onClick={() => setEditData({...editData, presenter_id: null, presenter_name: null})}
                        >
                          <User size={14} /> Nenhum (Sem apresentador)
                        </DropdownMenuItem>
                        <Separator className="my-1 opacity-50" />
                        <div className="max-h-[200px] overflow-y-auto px-1 py-1 space-y-1 custom-scrollbar">
                          {meetingParticipants.length === 0 ? (
                            <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                              Adicione pessoas à reunião primeiro
                            </div>
                          ) : (
                            meetingParticipants.map(mp => (
                              <DropdownMenuItem 
                                key={mp.id} 
                                className="rounded-xl py-2.5 px-3 text-xs font-bold gap-3 cursor-pointer"
                                onClick={() => setEditData({...editData, presenter_id: mp.id, presenter_name: mp.name})}
                              >
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary border border-primary/20 shrink-0">
                                  {mp.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{mp.name}</span>
                                {(editData as Topic).presenter_id === mp.id && <Check size={14} className="ml-auto text-primary" />}
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                 <div className="flex items-center gap-3">
                   <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Duração</Label>
                   <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-1 border border-border/50">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setEditData({...editData, duration_minutes: Math.max(1, editData.duration_minutes - 5)})}
                      >
                        <Minus size={14} />
                      </Button>
                      <Input 
                        type="number"
                        value={editData.duration_minutes} 
                        onChange={(e) => setEditData({...editData, duration_minutes: Number(e.target.value)})}
                        className="h-8 w-14 bg-transparent border-none text-center font-mono font-bold focus-visible:ring-0"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setEditData({...editData, duration_minutes: editData.duration_minutes + 5})}
                      >
                        <Plus size={14} />
                      </Button>
                   </div>
                   <span className="text-[10px] text-muted-foreground font-bold">min</span>
                 </div>
                 <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="rounded-xl h-10 px-4 text-xs font-bold" onClick={() => setIsEditing(false)}>Cancelar</Button>
                   <Button size="sm" className="rounded-xl h-10 px-6 font-bold shadow-lg shadow-primary/20" onClick={handleSave}>Salvar Alterações</Button>
                 </div>
              </div>
            </div>
          ) : (
            <div 
              className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 cursor-pointer group/title"
              onClick={() => { setIsEditing(true); setEditData({ ...item }); }}
            >
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
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
                  {isHighRisk && (
                     <Badge variant="destructive" className="ml-2 h-5 text-[9px] uppercase font-black px-2">Risco Alto: Muitos Obrigatórios</Badge>
                  )}
                </div>
                {isTopic && (
                  <div className="mt-3 flex flex-col gap-3">
                        <div className="flex flex-wrap gap-6">
                           {/* Required Zone */}
                           <div 
                             ref={requiredRef}
                             className={`flex flex-col gap-2 p-3 rounded-[1.5rem] border-2 border-dashed transition-all min-w-[180px] flex-1 lg:flex-none ${
                               isOverRequired ? 'bg-primary/5 border-primary scale-[1.02] shadow-xl shadow-primary/5' : 'bg-muted/10 border-transparent'
                             }`}
                           >
                             <div className="flex items-center justify-between mb-1 px-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Obrigatórios</span>
                                </div>
                                <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black border-muted-foreground/20 text-muted-foreground/40">{itemParticipants.filter(p => p.role === 'required').length}</Badge>
                             </div>
                             <div className="flex flex-wrap gap-2">
                               {itemParticipants.filter(p => p.role === 'required').map(p => (
                                <motion.div 
                                  key={p.id} 
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-white shadow-md shadow-primary/20 select-none cursor-pointer group/pill border border-white/10"
                                  onClick={(e) => { e.stopPropagation(); onToggleRole(p.id, 'required'); }}
                                >
                                   <span className="text-[10px] truncate max-w-[100px] font-black uppercase tracking-tight">{p.name}</span>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                                     className="ml-0.5 opacity-40 group-hover/pill:opacity-100 hover:text-red-200 transition-all font-normal"
                                   >
                                     <X size={10} />
                                   </button>
                                </motion.div>
                               ))}
                               {itemParticipants.filter(p => p.role === 'required').length === 0 && !isOverRequired && (
                                 <div className="text-[10px] text-muted-foreground/20 font-black uppercase tracking-widest py-2 px-2">Vazio</div>
                               )}
                             </div>
                           </div>
    
                           {/* Optional Zone */}
                           <div 
                             ref={optionalRef}
                             className={`flex flex-col gap-2 p-3 rounded-[1.5rem] border-2 border-dashed transition-all min-w-[180px] flex-1 lg:flex-none ${
                               isOverOptional ? 'bg-muted border-muted-foreground/30 scale-[1.02] shadow-xl shadow-black/5' : 'bg-muted/10 border-transparent'
                             }`}
                           >
                             <div className="flex items-center justify-between mb-1 px-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Opcionais</span>
                                </div>
                                <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black border-muted-foreground/20 text-muted-foreground/40">{itemParticipants.filter(p => p.role === 'optional').length}</Badge>
                             </div>
                             <div className="flex flex-wrap gap-2">
                               {itemParticipants.filter(p => p.role === 'optional').map(p => (
                                <motion.div 
                                  key={p.id} 
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card border-border/50 text-foreground font-black shadow-sm select-none cursor-pointer group/pill"
                                  onClick={(e) => { e.stopPropagation(); onToggleRole(p.id, 'optional'); }}
                                >
                                   <span className="text-[10px] truncate max-w-[100px] uppercase tracking-tight">{p.name}</span>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); onRemoveParticipant(p.id); }}
                                     className="ml-0.5 opacity-40 group-hover/pill:opacity-100 hover:text-primary transition-all font-normal"
                                   >
                                     <X size={10} />
                                   </button>
                                </motion.div>
                               ))}
                               {itemParticipants.filter(p => p.role === 'optional').length === 0 && !isOverOptional && (
                                 <div className="text-[10px] text-muted-foreground/20 font-black uppercase tracking-widest py-2 px-2">Vazio</div>
                               )}
                             </div>
                           </div>
                        </div>
                  </div>
                )}
              </div>

              {isTopic && (
                <div 
                  ref={presenterRef}
                  className={`flex-shrink-0 min-w-[200px] lg:border-l lg:pl-8 lg:border-border/30 transition-all rounded-3xl ${
                    isOverPresenter ? 'bg-primary/10 scale-105 shadow-2xl shadow-primary/20 p-2' : ''
                  }`}
                >
                  <div 
                    className="flex items-center gap-3 group/pres px-3 py-2 rounded-2xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all w-fit lg:w-full"
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  >
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border transition-all shadow-md ${
                      (item as Topic).presenter_id 
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 rotate-3 translate-y-[-2px]' 
                        : 'bg-muted/50 text-muted-foreground border-border/50 border-dashed'
                    }`}>
                      {(item as Topic).presenter_id ? (
                        <span className="text-base font-black">{(item as Topic).presenter_name?.charAt(0).toUpperCase()}</span>
                      ) : (
                        <Mic size={22} className="opacity-40" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                       <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/40 leading-tight">🎤 Apresentador</span>
                       <span className={`text-[14px] font-bold truncate max-w-[140px] ${(item as Topic).presenter_id ? 'text-foreground' : 'text-muted-foreground/30 italic font-medium'}`}>
                         {(item as Topic).presenter_name || 'Arraste para definir'}
                       </span>
                    </div>
                  </div>
                </div>
              )}
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
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [globalParticipants, setGlobalParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [newTag, setNewTag] = useState('');
  
  const [participantSearch, setParticipantSearch] = useState('');
  const [newMPName, setNewMPName] = useState('');

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

      const { data: mParts, error: meError } = await supabase
        .from('meeting_participants')
        .select('*')
        .eq('meeting_id', id);
      if (!meError) setMeetingParticipants(mParts || []);

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
        .update({ 
          start_time: newStartTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating start time:', error);
        throw error;
      }
      
      setMeeting(prev => prev ? { ...prev, start_time: newStartTime } : null);
      toast.success('Horário de início atualizado');
    } catch (error: any) {
      console.error('Error in updateStartTime:', error);
      toast.error('Erro ao atualizar horário');
      
      if (error.message?.includes('column') && error.message?.includes('start_time')) {
        toast.info('A coluna "start_time" parece estar faltando.');
      }
    }
  };

  const updateMeetingDate = async (newDate: string) => {
    try {
      const dateValue = newDate || null;
      const { error } = await supabase
        .from('meetings')
        .update({ 
          event_date: dateValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating meeting date:', error);
        throw error;
      }
      
      setMeeting(prev => prev ? { ...prev, event_date: dateValue } : null);
      toast.success('Data atualizada');
    } catch (error: any) {
      console.error('Error in updateMeetingDate:', error);
      toast.error('Erro ao atualizar data');
      
      // If it's a missing column error, inform the user
      if (error.message?.includes('column') && error.message?.includes('event_date')) {
        toast.info('A coluna "event_date" parece estar faltando no banco de dados.');
      }
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
      
      const { error } = await supabase.from(dbTable).update(updates).eq('id', itemId);
      
      if (error) throw error;

      setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
      toast.success('Agenda atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar item');
    }
  };

  const addMeetingParticipant = async (name: string) => {
    if (!name.trim()) return;
    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .insert([{ meeting_id: id, name, email: '' }])
        .select()
        .single();
      if (error) throw error;
      setMeetingParticipants(prev => [...prev, data]);
      setNewMPName('');
      toast.success('Participante adicionado à reunião');
      
      // Also ensure it exists in global list if not there
      ensureGlobalParticipant(name);
    } catch (error) {
      toast.error('Erro ao adicionar participante');
    }
  };

  const removeMeetingParticipant = async (mpId: string) => {
    try {
      await supabase.from('meeting_participants').delete().eq('id', mpId);
      
      // Update local state and linked topics
      setMeetingParticipants(prev => prev.filter(p => p.id !== mpId));
      setParticipants(prev => prev.filter(p => p.meeting_participant_id !== mpId));
      
      // Also reset presenter if this person was a presenter
      setItems(prev => prev.map(item => {
        if (item.type === 'topic' && item.presenter_id === mpId) {
          return { ...item, presenter_id: null, presenter_name: null };
        }
        return item;
      }));

      // Persist presenter reset
      await supabase.from('topics').update({ presenter_id: null, presenter_name: null }).eq('presenter_id', mpId);

      toast.success('Participante removido da reunião');
    } catch (error) {
      toast.error('Erro ao remover participante');
    }
  };

  const addParticipantToTopic = async (topicId: string, meetingParticipantId: string, role: 'required' | 'optional' = 'optional') => {
    const existing = participants.find(p => p.topic_id === topicId && p.meeting_participant_id === meetingParticipantId);
    if (existing) {
      toast.info('Participante já está neste tópico');
      return;
    }

    const mp = meetingParticipants.find(p => p.id === meetingParticipantId);
    if (!mp) return;

    try {
      const { data, error } = await supabase
        .from('topic_participants')
        .insert([{ 
          topic_id: topicId, 
          meeting_participant_id: meetingParticipantId,
          participant_name: mp.name, // Keep for backward compatibility/constraint
          role 
        }])
        .select()
        .single();
      if (error) throw error;
      setParticipants(prev => [...prev, data]);
    } catch (error) {
      console.error('Error adding participant:', error);
      toast.error('Erro ao vincular participante ao tópico');
    }
  };

  const toggleParticipantRole = async (tpId: string, currentRole: 'required' | 'optional') => {
    const newRole = currentRole === 'required' ? 'optional' : 'required';
    try {
      const { error } = await supabase
        .from('topic_participants')
        .update({ role: newRole })
        .eq('id', tpId);
      if (error) throw error;
      setParticipants(prev => prev.map(p => p.id === tpId ? { ...p, role: newRole } : p));
    } catch (error) {
      toast.error('Erro ao alterar papel');
    }
  };

  const removeParticipantFromTopic = async (tpId: string) => {
    try {
      await supabase.from('topic_participants').delete().eq('id', tpId);
      setParticipants(prev => prev.filter(p => p.id !== tpId));
    } catch (error) {
      toast.error('Erro ao remover participante do tópico');
    }
  };

  const addAllParticipantsToTopic = async (topicId: string, role: 'required' | 'optional') => {
    const payloads = meetingParticipants
      .filter(mp => !participants.find(p => p.topic_id === topicId && p.meeting_participant_id === mp.id))
      .map(mp => ({
        topic_id: topicId,
        meeting_participant_id: mp.id,
        participant_name: mp.name,
        role
      }));

    if (payloads.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('topic_participants')
        .insert(payloads)
        .select();
      if (error) throw error;
      setParticipants(prev => [...prev, ...data]);
      toast.success(`${data.length} participantes adicionados`);
    } catch (error) {
      toast.error('Erro ao adicionar todos');
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
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Handle Participant dropped on specific zone
    if (activeId.startsWith('participant-')) {
      const participantId = activeId.replace('participant-', '');
      
      // Target can be a specific zone: presenter-{topicId}, required-{topicId}, optional-{topicId}
      if (overId.includes('-')) {
        const [role, topicId] = overId.split('-');
        if (role === 'presenter' || role === 'required' || role === 'optional') {
          handleParticipantDrop(participantId, topicId, role as any);
          return;
        }
      }
      
      // Fallback: dropped on the general topic card
      const topic = items.find(i => i.id === overId && i.type === 'topic');
      if (topic) {
        handleParticipantDrop(participantId, overId, 'optional');
      }
      return;
    }

    if (activeId !== overId) {
      const oldIndex = items.findIndex(i => i.id === activeId);
      const newIndex = items.findIndex(i => i.id === overId);
      
      if (oldIndex === -1 || newIndex === -1) return;

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

  const handleParticipantDrop = async (mpId: string, topicId: string, role: 'presenter' | 'required' | 'optional') => {
    try {
      const mp = meetingParticipants.find(p => p.id === mpId);
      if (!mp) return;

      if (role === 'presenter') {
        // Set as presenter
        await updateItem(topicId, 'topic', { presenter_id: mp.id, presenter_name: mp.name });
        
        // Remove from other roles for this topic if present
        const existing = participants.find(p => p.topic_id === topicId && p.meeting_participant_id === mpId);
        if (existing) {
          await removeParticipantFromTopic(existing.id);
        }
        toast.success(`${mp.name} é o apresentador`);
      } else {
        // Add as required or optional
        // If they were presenter, clear it
        const topic = items.find(i => i.id === topicId) as Topic;
        if (topic && topic.presenter_id === mpId) {
          await updateItem(topicId, 'topic', { presenter_id: null, presenter_name: null });
        }

        // Check if they were already in another role for this topic
        const existing = participants.find(p => p.topic_id === topicId && p.meeting_participant_id === mpId);
        if (existing) {
          if (existing.role !== role) {
             await toggleParticipantRole(existing.id, existing.role as any);
          }
        } else {
          await addParticipantToTopic(topicId, mpId, role);
        }
        toast.success(`${mp.name} adicionado como ${role === 'required' ? 'obrigatório' : 'opcional'}`);
      }
    } catch (error) {
      toast.error('Erro ao atribuir papel');
    }
  };

  const meetingEndTime = useMemo(() => {
    if (itemTimings.length === 0) return null;
    return itemTimings[itemTimings.length - 1].end;
  }, [itemTimings]);

  if (loading && !meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMin = calculateTotalTime();

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* SaaS Breadcrumbs & Actions Header */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group/back">
              <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center group-hover/back:bg-muted transition-colors">
                <ChevronLeft size={16} />
              </div>
              Dashboard
            </Link>
            <ChevronRight size={14} className="text-muted-foreground/30" />
            <span className="text-foreground font-black tracking-tight">{meeting?.title}</span>
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

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-10">
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
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
                      className="h-16 text-5xl font-black tracking-tight bg-transparent border-none p-0 focus-visible:ring-0 shadow-none -ml-1"
                    />
                  </motion.div>
                ) : (
                  <motion.h1 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-5xl lg:text-6xl font-black tracking-tight cursor-text hover:text-primary transition-colors leading-tight min-h-[60px]"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {meeting?.title}
                  </motion.h1>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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

              <div className="flex items-center gap-1.5 px-4 h-9 bg-card border border-border/50 rounded-2xl shadow-sm">
                <Calendar size={14} className="text-primary/70" />
                <input 
                  type="date" 
                  value={meeting?.event_date || ''}
                  onChange={(e) => updateMeetingDate(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest outline-none focus:text-primary transition-colors cursor-pointer"
                  title="Data da Reunião"
                />
              </div>

              <div className="flex items-center gap-1.5 px-4 h-9 bg-card border border-border/50 rounded-2xl shadow-sm">
                <Clock size={14} className="text-primary/70" />
                <div className="flex items-center gap-2">
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
                    className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest outline-none focus:text-primary transition-colors cursor-pointer"
                    title="Horário de Início"
                  />
                  <span className="text-muted-foreground/30 font-black text-[10px]">→</span>
                  <span className="text-[11px] font-black text-primary font-mono uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                    {meetingEndTime || '--:--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 h-full lg:pt-2">
            <div className="hidden lg:flex flex-col items-end gap-1 px-4 border-r border-border/50">
               <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Duração Total</span>
               <span className="text-2xl font-black font-mono tabular-nums">{totalMin}m</span>
            </div>
            <Button 
              className="rounded-2xl h-14 px-12 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all bg-primary hover:bg-primary/90"
              onClick={() => navigate(`/meeting/${id}/run`)}
            >
              <Play size={22} className="mr-3 fill-current" />
              Ver Modo Foco
            </Button>
          </div>
        </div>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
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
                      meetingParticipants={meetingParticipants}
                      onDelete={deleteItem}
                      onUpdate={updateItem}
                      onAddParticipant={addParticipantToTopic}
                      onRemoveParticipant={removeParticipantFromTopic}
                      onToggleRole={toggleParticipantRole}
                      startTime={meeting?.start_time}
                      timing={itemTimings[index]}
                      globalParticipants={globalParticipants}
                    />
                  ))
                )}
              </div>
            </SortableContext>
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

            {/* Participants Management */}
            <div className="p-8 bg-card border border-border/50 rounded-[2.5rem] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Users size={14} /> Participantes da Reunião
                </h3>
                <Badge variant="outline" className="rounded-full px-2 py-0 font-bold tabular-nums">
                  {meetingParticipants.length}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <Input 
                    placeholder="Buscar participante..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="h-9 pl-9 rounded-xl bg-muted/30 border-none text-xs focus:bg-background"
                  />
                </div>

                <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {meetingParticipants
                    .filter(mp => mp.name.toLowerCase().includes(participantSearch.toLowerCase()))
                    .map(mp => (
                      <DraggableParticipant key={mp.id} participant={mp} onRemove={removeMeetingParticipant} />
                    ))}
                  
                  {meetingParticipants.filter(mp => mp.name.toLowerCase().includes(participantSearch.toLowerCase())).length === 0 && (
                    <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                      Nenhum participante encontrado
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input 
                    placeholder="Novo nome..."
                    value={newMPName}
                    onChange={(e) => setNewMPName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMeetingParticipant(newMPName)}
                    className="h-9 rounded-xl bg-muted/30 border-none text-xs"
                  />
                  <Button 
                    size="icon" 
                    className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => addMeetingParticipant(newMPName)}
                  >
                    <UserPlus size={16} />
                  </Button>
                </div>
                
                <div className="pt-2 border-t border-border/30">
                   <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-between h-9 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted")}>
                         Ações Rápidas <ChevronDown size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl border-border bg-card p-2 shadow-2xl min-w-[200px]">
                        <DropdownMenuItem 
                          className="gap-2 rounded-xl cursor-pointer py-3 text-xs font-bold"
                          onClick={() => {
                            const currentTopic = items.find(i => i.type === 'topic');
                            if (currentTopic) addAllParticipantsToTopic(currentTopic.id, 'required');
                          }}
                        >
                          <Star size={14} className="text-primary fill-current" /> Add todos obrigatórios
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 rounded-xl cursor-pointer py-3 text-xs font-bold"
                          onClick={() => {
                            const currentTopic = items.find(i => i.type === 'topic');
                            if (currentTopic) addAllParticipantsToTopic(currentTopic.id, 'optional');
                          }}
                        >
                          <Minus size={14} /> Add todos opcionais
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>
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
      </DndContext>
    </div>
  );
}

