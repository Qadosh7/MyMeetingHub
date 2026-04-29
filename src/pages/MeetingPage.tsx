import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, deleteDoc, query, where, orderBy, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting, Topic, Break, AgendaItem, TopicParticipant, Participant, MeetingParticipant, Contact } from '@/src/types';
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
  onUpdate: (id: string, name: string) => void | Promise<void>;
}

const DraggableParticipant: React.FC<DraggableParticipantProps> = ({ participant, onRemove, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(participant.name);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `participant-${participant.id}`,
    data: { participant },
    disabled: isEditing
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  const handleUpdate = () => {
    if (editName.trim() && editName !== participant.name) {
      onUpdate(participant.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center justify-between p-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all group",
        isDragging ? "opacity-50" : "",
        !isEditing && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0",
          participant.role === 'required' 
            ? "bg-primary/20 text-primary border-primary/30" 
            : "bg-muted text-muted-foreground border-border"
        )}>
          {participant.name.charAt(0).toUpperCase()}
        </div>
        
        {isEditing ? (
          <Input 
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            autoFocus
            className="h-7 text-[11px] font-bold bg-background border-primary/20 flex-1"
          />
        ) : (
          <div 
            className="flex flex-col min-w-0 flex-1 cursor-text"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            <span className="text-[11px] font-bold text-foreground/80 truncate max-w-[120px] leading-tight">{participant.name}</span>
            <span className={cn(
              "text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5",
              participant.role === 'required' ? "text-primary/70" : "text-muted-foreground/50"
            )}>
              {participant.role === 'required' ? 'Obrigatório' : 'Opcional'}
            </span>
          </div>
        )}
      </div>
      
      {!isEditing && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(participant.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
        >
          <X size={12} />
        </button>
      )}
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, `users/${user.uid}/contacts`),
        orderBy('lastUsedAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const suggestions = useMemo(() => {
    if (!newMPName) return [];
    return contacts.filter(c => 
      c.name.toLowerCase().includes(newMPName.toLowerCase()) && 
      !meetingParticipants.some(mp => mp.name.toLowerCase() === c.name.toLowerCase())
    ).slice(0, 5);
  }, [newMPName, contacts, meetingParticipants]);

  const toggleFavorite = async () => {
    if (!meeting || !id) return;
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        is_favorite: !meeting.is_favorite,
        updated_at: new Date().toISOString()
      });
      setMeeting({ ...meeting, is_favorite: !meeting.is_favorite });
      toast.success(meeting.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const addTag = async () => {
    if (!newTag.trim() || !meeting || !id) return;
    const currentTags = meeting.tags || [];
    if (currentTags.includes(newTag.trim())) {
      setNewTag('');
      return;
    }
    const updatedTags = [...currentTags, newTag.trim()];
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        tags: updatedTags,
        updated_at: new Date().toISOString()
      });
      setMeeting({ ...meeting, tags: updatedTags });
      setNewTag('');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!meeting || !id) return;
    const updatedTags = (meeting.tags || []).filter(t => t !== tagToRemove);
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        tags: updatedTags,
        updated_at: new Date().toISOString()
      });
      setMeeting({ ...meeting, tags: updatedTags });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const updateMeetingMetadata = async (
    params?: {
      items?: AgendaItem[], 
      participants?: MeetingParticipant[],
      startTime?: string
    }
  ) => {
    if (!id || !meeting) return;
    
    const itemsToUse = params?.items || items;
    const participantsToUse = params?.participants || meetingParticipants;
    const startTimeToUse = params?.startTime || meeting.start_time;
    
    const total_duration = itemsToUse.reduce((acc, item) => acc + (item.duration_minutes || 0), 0);
    const topics_count = itemsToUse.filter(item => item.type === 'topic').length;
    const participants_count = participantsToUse.length;
    
    let end_time = meeting.end_time;
    if (startTimeToUse) {
      try {
        const start = new Date(startTimeToUse);
        end_time = new Date(start.getTime() + total_duration * 60000).toISOString();
      } catch (e) {
        console.error('Invalid start_time');
      }
    }
    
    try {
      const meetingRef = doc(db, 'meetings', id);
      const updates: any = {
        total_duration,
        topics_count,
        participants_count,
        updated_at: new Date().toISOString()
      };
      if (end_time) updates.end_time = end_time;

      await updateDoc(meetingRef, updates);
      setMeeting(prev => prev ? { 
        ...prev, 
        total_duration, 
        topics_count, 
        participants_count,
        end_time
      } : null);
    } catch (error) {
      console.error('Error updating meeting metadata:', error);
    }
  };

  const fetchMeetingData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      
      const meetingSnap = await getDoc(doc(db, 'meetings', id));
      if (!meetingSnap.exists()) {
        toast.error('Reunião não encontrada.');
        navigate('/');
        return;
      }
      
      const meetingData = { id: meetingSnap.id, ...meetingSnap.data() } as Meeting;
      setMeeting(meetingData);
      setTitleInput(meetingData.title);

      // Fetch global participants
      const gPartsSnap = await getDocs(collection(db, 'global_participants'));
      setGlobalParticipants(gPartsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));

      // Fetch meeting participants
      const mPartsSnap = await getDocs(collection(db, `meetings/${id}/participants`));
      const mParticipants = mPartsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MeetingParticipant));
      setMeetingParticipants(mParticipants);

      // Fetch topics and breaks
      const topicsSnap = await getDocs(collection(db, `meetings/${id}/topics`));
      const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'topic' as const } as Topic & { type: 'topic' }));

      const breaksSnap = await getDocs(collection(db, `meetings/${id}/breaks`));
      const breaks = breaksSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'break' as const } as Break & { type: 'break' }));

      // Fetch all topic participants for all topics
      const allTopicParticipants: TopicParticipant[] = [];
      await Promise.all(topics.map(async (topic) => {
        const tpSnap = await getDocs(collection(db, `meetings/${id}/topics/${topic.id}/topic_participants`));
        tpSnap.docs.forEach(d => {
          allTopicParticipants.push({ id: d.id, topic_id: topic.id, ...d.data() } as TopicParticipant);
        });
      }));
      setParticipants(allTopicParticipants);

      const merged: AgendaItem[] = [...topics, ...breaks].sort((a, b) => a.order_index - b.order_index);
      setItems(merged);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.GET, `meetings/${id}`);
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
    if (!id) return;
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        start_time: newStartTime,
        updated_at: new Date().toISOString()
      });
      setMeeting(prev => prev ? { ...prev, start_time: newStartTime } : null);
      updateMeetingMetadata({ startTime: newStartTime });
      toast.success('Horário de início atualizado');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const updateMeetingDate = async (newDate: string) => {
    if (!id) return;
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        event_date: newDate || null,
        updated_at: new Date().toISOString()
      });
      setMeeting(prev => prev ? { ...prev, event_date: newDate || null } : null);
      updateMeetingMetadata({ startTime: meeting?.start_time ? new Date(newDate + 'T' + format(parseISO(meeting.start_time), 'HH:mm:ss')).toISOString() : undefined });
      toast.success('Data atualizada');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const updateMeetingTitle = async () => {
    if (!titleInput.trim() || titleInput === meeting?.title || !id) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const meetingRef = doc(db, 'meetings', id);
      await updateDoc(meetingRef, {
        title: titleInput,
        updated_at: new Date().toISOString()
      });
      setMeeting(prev => prev ? { ...prev, title: titleInput } : null);
      setIsEditingTitle(false);
      toast.success('Título atualizado');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  };

  const addItem = async (type: 'topic' | 'break', customTitle?: string, customDuration?: number) => {
    if (!id) return;
    const nextIndex = items.length;
    const body: any = {
      title: customTitle || (type === 'topic' ? 'Novo Tópico' : 'Intervalo'),
      duration_minutes: customDuration || (type === 'topic' ? 15 : 10),
      order_index: nextIndex,
      type
    };

    try {
      const collectionName = type === 'topic' ? 'topics' : 'breaks';
      const docRef = await addDoc(collection(db, `meetings/${id}/${collectionName}`), body);
      const newItem = { id: docRef.id, ...body } as AgendaItem;
      const newItems = [...items, newItem];
      setItems(newItems);
      updateMeetingMetadata({ items: newItems });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `meetings/${id}/${type}s`);
    }
  };

  const deleteItem = async (itemId: string, type: 'topic' | 'break') => {
    if (!id) return;
    try {
      const collectionName = type === 'topic' ? 'topics' : 'breaks';
      await deleteDoc(doc(db, `meetings/${id}/${collectionName}`, itemId));
      const newItems = items.filter(item => item.id !== itemId);
      setItems(newItems);
      updateMeetingMetadata({ items: newItems });
      toast.success('Item removido');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `meetings/${id}/${type}s/${itemId}`);
    }
  };

  const updateItem = async (itemId: string, type: 'topic' | 'break', updates: any) => {
    if (!id) return;
    try {
      const collectionName = type === 'topic' ? 'topics' : 'breaks';
      const itemRef = doc(db, `meetings/${id}/${collectionName}`, itemId);
      await updateDoc(itemRef, updates);

      const newItems = items.map(item => item.id === itemId ? { ...item, ...updates } : item);
      setItems(newItems);
      if (updates.duration_minutes !== undefined) {
        updateMeetingMetadata({ items: newItems });
      }
      toast.success('Agenda atualizada');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}/${type}s/${itemId}`);
    }
  };

  const addMeetingParticipant = async (name: string, role: 'required' | 'optional' = 'required') => {
    const trimmedName = name.trim();
    if (!trimmedName || !id) {
      if (!trimmedName) toast.error('Digite o nome do profissional');
      return;
    }

    try {
      const participantData = {
        name: trimmedName,
        role: role,
        createdAt: serverTimestamp(),
        created_at: new Date().toISOString() // Compatibility
      };

      const docRef = await addDoc(collection(db, `meetings/${id}/participants`), participantData);
      const data = { id: docRef.id, ...participantData, createdAt: new Date().toISOString() } as MeetingParticipant;
      
      setMeetingParticipants(prev => {
        const newParticipants = [...prev, data];
        updateMeetingMetadata({ participants: newParticipants });
        return newParticipants;
      });
      setNewMPName('');
      setShowSuggestions(false);
      toast.success(`${trimmedName} adicionado como ${role === 'required' ? 'obrigatório' : 'opcional'}`);
      
      ensureGlobalContact(trimmedName);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `meetings/${id}/participants`);
    }
  };

  const updateMeetingParticipant = async (mpId: string, name: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, `meetings/${id}/participants`, mpId), { name });
      setMeetingParticipants(prev => prev.map(p => p.id === mpId ? { ...p, name } : p));
      
      // Update assignments too
      setParticipants(prev => prev.map(p => p.meeting_participant_id === mpId ? { ...p, name } : p));
      
      // Update presentations
      setItems(prev => prev.map(item => {
        if (item.type === 'topic' && item.presenter_id === mpId) {
          return { ...item, presenter_name: name };
        }
        return item;
      }));

      // Persistence: Presenter fields are on the topic doc itself
      const topicsWithThisPresenter = items.filter(i => i.type === 'topic' && (i as Topic).presenter_id === mpId);
      await Promise.all(topicsWithThisPresenter.map(async (t) => {
         await updateDoc(doc(db, `meetings/${id}/topics`, t.id), { presenter_name: name });
      }));

      toast.success('Nome atualizado');
      ensureGlobalContact(name);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}/participants/${mpId}`);
    }
  };

  const removeMeetingParticipant = async (mpId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, `meetings/${id}/participants`, mpId));
      
      const newParticipants = meetingParticipants.filter(p => p.id !== mpId);
      setMeetingParticipants(newParticipants);
      updateMeetingMetadata({ participants: newParticipants });
      // Topic assignments need to be cleared too. 
      // This is more complex because they are in subcollections of topics.
      // We'll iterate through all topics and clear assignments for this MP.
      setParticipants(prev => prev.filter(p => p.meeting_participant_id !== mpId));
      
      // Update local items for presenter reset
      setItems(prev => prev.map(item => {
        if (item.type === 'topic' && item.presenter_id === mpId) {
          return { ...item, presenter_id: null, presenter_name: null };
        }
        return item;
      }));

      // Persistence: Presenter fields are on the topic doc itself
      const topicsWithThisPresenter = items.filter(i => i.type === 'topic' && (i as Topic).presenter_id === mpId);
      await Promise.all(topicsWithThisPresenter.map(async (t) => {
         await updateDoc(doc(db, `meetings/${id}/topics`, t.id), { presenter_id: null, presenter_name: null });
      }));

      toast.success('Participante removido da reunião');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `meetings/${id}/participants/${mpId}`);
    }
  };

  const addParticipantToTopic = async (topicId: string, meetingParticipantId: string, role: 'required' | 'optional' = 'optional') => {
    if (!id) return;
    const existing = participants.find(p => p.topic_id === topicId && p.meeting_participant_id === meetingParticipantId);
    if (existing) {
      toast.info('Participante já está neste tópico');
      return;
    }

    const mp = meetingParticipants.find(p => p.id === meetingParticipantId);
    if (!mp) return;

    try {
      const tpData = { 
        meeting_participant_id: meetingParticipantId,
        participant_name: mp.name,
        role,
        created_at: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, `meetings/${id}/topics/${topicId}/topic_participants`), tpData);
      const data = { id: docRef.id, topic_id: topicId, ...tpData };
      setParticipants(prev => [...prev, data]);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `meetings/${id}/topics/${topicId}/topic_participants`);
    }
  };

  const toggleParticipantRole = async (tpId: string, currentRole: 'required' | 'optional') => {
    if (!id) return;
    const newRole = currentRole === 'required' ? 'optional' : 'required';
    // We need to find which topic this assignment belongs to
    const assignment = participants.find(p => p.id === tpId);
    if (!assignment || !assignment.topic_id) return;

    try {
      await updateDoc(doc(db, `meetings/${id}/topics/${assignment.topic_id}/topic_participants`, tpId), { role: newRole });
      setParticipants(prev => prev.map(p => p.id === tpId ? { ...p, role: newRole } : p));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}/topics/${assignment.topic_id}/topic_participants/${tpId}`);
    }
  };

  const removeParticipantFromTopic = async (tpId: string) => {
    if (!id) return;
    const assignment = participants.find(p => p.id === tpId);
    if (!assignment || !assignment.topic_id) return;

    try {
      await deleteDoc(doc(db, `meetings/${id}/topics/${assignment.topic_id}/topic_participants`, tpId));
      setParticipants(prev => prev.filter(p => p.id !== tpId));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `meetings/${id}/topics/${assignment.topic_id}/topic_participants/${tpId}`);
    }
  };

  const addAllParticipantsToTopic = async (topicId: string, role: 'required' | 'optional') => {
    if (!id) return;
    const missingMPs = meetingParticipants.filter(mp => !participants.find(p => p.topic_id === topicId && p.meeting_participant_id === mp.id));
    if (missingMPs.length === 0) return;

    try {
      const addedParticipants: TopicParticipant[] = [];
      await Promise.all(missingMPs.map(async (mp) => {
        const tpData = {
          meeting_participant_id: mp.id,
          participant_name: mp.name,
          role,
          created_at: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, `meetings/${id}/topics/${topicId}/topic_participants`), tpData);
        addedParticipants.push({ id: docRef.id, topic_id: topicId, ...tpData });
      }));
      
      setParticipants(prev => [...prev, ...addedParticipants]);
      toast.success(`${addedParticipants.length} participantes adicionados`);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `meetings/${id}/topics/${topicId}/topic_participants`);
    }
  };

  const ensureGlobalContact = async (name: string): Promise<void> => {
    if (!user) return;
    
    try {
      // Find by name
      const q = query(
        collection(db, `users/${user.uid}/contacts`),
        where('name', '==', name)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Update lastUsedAt
        const contactId = snap.docs[0].id;
        await updateDoc(doc(db, `users/${user.uid}/contacts`, contactId), {
          lastUsedAt: serverTimestamp()
        });
      } else {
        // Create new
        await addDoc(collection(db, `users/${user.uid}/contacts`), {
          name,
          lastUsedAt: serverTimestamp()
        });
      }
      fetchContacts();
    } catch (error) {
      console.error('Error ensuring contact:', error);
    }
  };

  const removeParticipant = async (participantId: string) => {
    // This seems related to removing an assignment
    await removeParticipantFromTopic(participantId);
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
        await Promise.all(newArray.map(async (item: AgendaItem, index: number) => {
          const collectionName = item.type === 'topic' ? 'topics' : 'breaks';
          await updateDoc(doc(db, `meetings/${id}/${collectionName}`, item.id), { order_index: index });
        }));
      } catch (error: any) {
        handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}/agenda/reorder`);
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
                      <DraggableParticipant 
                        key={mp.id} 
                        participant={mp} 
                        onRemove={removeMeetingParticipant}
                        onUpdate={updateMeetingParticipant}
                      />
                    ))}
                  
                  {meetingParticipants.filter(mp => mp.name.toLowerCase().includes(participantSearch.toLowerCase())).length === 0 && (
                    <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                      Nenhum participante encontrado
                    </div>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <div className="relative">
                    <Input 
                      placeholder="Novo nome..."
                      value={newMPName}
                      onChange={(e) => {
                        setNewMPName(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onBlur={() => {
                        // Delay hide suggestions to allow clicking one
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.shiftKey) {
                            addMeetingParticipant(newMPName, 'optional');
                          } else {
                            addMeetingParticipant(newMPName, 'required');
                          }
                        }
                      }}
                      className="h-9 rounded-xl bg-muted/30 border-none text-xs"
                    />
                    
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full mb-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-20">
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            className="w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-muted transition-colors flex items-center justify-between group"
                            onClick={() => addMeetingParticipant(s.name, 'required')}
                          >
                            <span>{s.name}</span>
                            <UserPlus size={12} className="opacity-0 group-hover:opacity-40" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      size="sm" 
                      className="h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black uppercase tracking-widest gap-2 shadow-none border-none"
                      onClick={() => addMeetingParticipant(newMPName, 'required')}
                    >
                      <Plus size={14} /> Obrigatório
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-10 rounded-xl border-border/50 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-muted"
                      onClick={() => addMeetingParticipant(newMPName, 'optional')}
                    >
                      <Plus size={14} /> Opcional
                    </Button>
                  </div>
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

