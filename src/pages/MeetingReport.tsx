import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import { Meeting, MeetingExecutionLog, AgendaItem, TopicParticipant, MeetingParticipant, Topic, Break } from '@/src/types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, Clock, AlertTriangle, CheckCircle2, 
  ArrowLeft, Share2, Download, Zap, Minus, Users, Star, UserCheck, SkipForward
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function MeetingReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [logs, setLogs] = useState<MeetingExecutionLog[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [topicParticipants, setTopicParticipants] = useState<TopicParticipant[]>([]);
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        setLoading(true);
        const meetingSnap = await getDoc(doc(db, 'meetings', id));
        if (!meetingSnap.exists()) {
          toast.error('Reunião não encontrada.');
          navigate('/');
          return;
        }
        setMeeting({ id: meetingSnap.id, ...meetingSnap.data() } as Meeting);

        const topicsSnap = await getDocs(collection(db, `meetings/${id}/topics`));
        const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'topic' as const })) as Topic[];

        const breaksSnap = await getDocs(collection(db, `meetings/${id}/breaks`));
        const breaks = breaksSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'break' as const })) as Break[];
        
        const merged: AgendaItem[] = [...topics, ...breaks].sort((a, b) => a.order_index - b.order_index);
        setItems(merged);

        const allTopicParticipants: TopicParticipant[] = [];
        await Promise.all(topics.map(async (topic) => {
          const tpSnap = await getDocs(collection(db, `meetings/${id}/topics/${topic.id}/topic_participants`));
          tpSnap.docs.forEach(d => {
            allTopicParticipants.push({ id: d.id, topic_id: topic.id, ...d.data() } as TopicParticipant);
          });
        }));
        setTopicParticipants(allTopicParticipants);

        const mpSnap = await getDocs(collection(db, `meetings/${id}/participants`));
        setMeetingParticipants(mpSnap.docs.map(d => ({ id: d.id, ...d.data() } as MeetingParticipant)));

        const logsSnap = await getDocs(query(collection(db, `meetings/${id}/executionLogs`), orderBy('started_at', 'asc')));
        setLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MeetingExecutionLog)));
      } catch (error: any) {
        handleFirestoreError(error, OperationType.GET, `meetings/${id}/report`);
        toast.error('Erro ao carregar relatório');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, navigate]);

  const stats = useMemo(() => {
    if (logs.length === 0) return null;

    const totalPlanned = logs.reduce((acc, log) => acc + log.planned_duration, 0);
    const totalActual = logs.reduce((acc, log) => acc + Number(log.actual_duration), 0);
    const totalExceeded = logs.reduce((acc, log) => acc + Number(log.exceeded_time), 0);
    const totalSkipped = logs.filter(l => l.skipped).length;
    const totalAdjustments = logs.reduce((acc, log) => acc + (log.time_adjustments || 0), 0);
    const totalAdjustmentCount = logs.reduce((acc, log) => acc + (log.adjustment_count || 0), 0);
    
    const efficiency = Math.max(0, Math.min(100, (totalPlanned / (totalActual + 0.001)) * 100));
    
    const requiredTotalCount = new Set(topicParticipants.filter(p => p.role === 'required').map(p => p.meeting_participant_id)).size;
    const optionalTotalCount = new Set(topicParticipants.filter(p => p.role === 'optional').map(p => p.meeting_participant_id)).size;

    // Meeting Score logic
    let score = 100;
    if (efficiency < 90) score -= (90 - efficiency);
    const exceededTopics = logs.filter(l => l.exceeded_time > 0).length;
    score -= (exceededTopics * 10);
    
    // Risk penalty: topics with too many required participants (> 5)
    const highRiskTopics = items.filter(i => {
      if (i.type !== 'topic') return false;
      const count = topicParticipants.filter(tp => tp.topic_id === i.id && tp.role === 'required').length;
      return count > 5;
    }).length;
    score -= (highRiskTopics * 5);
    
    score = Math.max(0, score);

    return {
      totalPlanned,
      totalActual,
      totalExceeded,
      totalSkipped,
      totalAdjustments,
      totalAdjustmentCount,
      efficiency: Math.round(efficiency),
      score: Math.round(score),
      exceededCount: exceededTopics,
      topicCount: logs.length,
      requiredCount: requiredTotalCount,
      optionalCount: optionalTotalCount,
      highRiskTopicsCount: highRiskTopics
    };
  }, [logs, topicParticipants, items]);

  const chartData = useMemo(() => {
    return logs.map((log) => {
      const item = items.find(i => i.id === log.topic_id);
      const actual = Number(log.actual_duration);
      const exceeded = Number(log.exceeded_time);
      return {
        name: item?.title || 'Item',
        planejado: log.planned_duration,
        real: Math.round(actual * 10) / 10,
        excedido: Math.round(exceeded * 10) / 10
      };
    });
  }, [logs, items]);

  const insights = useMemo(() => {
    if (!stats || logs.length === 0) return [];
    const results = [];

    if (stats.efficiency < 85) {
      results.push('A reunião superou significativamente o tempo planejado. Considere ser mais rigoroso com os limites de tempo ou planejar durações maiores.');
    } else if (stats.efficiency > 95) {
      results.push('Excelente controle de tempo! A reunião foi concluída quase exatamente como planejado.');
    }

    const worstTopic = [...logs].sort((a, b) => Number(b.exceeded_time) - Number(a.exceeded_time))[0];
    const worstExceeded = Number(worstTopic?.exceeded_time || 0);
    if (worstTopic && worstExceeded > 5) {
      const item = items.find(i => i.id === worstTopic.topic_id);
      results.push(`O tópico "${item?.title}" estourou em ${Math.round(worstExceeded)} min. Considere dividir este assunto em tópicos menores na próxima vez.`);
    }

    if (logs.length > 8) {
      results.push('Reuniões com muitos tópicos tendem a perder foco. Tente agrupar assuntos relacionados ou reduzir a pauta.');
    }

    return results;
  }, [stats, logs, items]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Zap className="animate-pulse text-primary h-12 w-12" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto p-8 text-center pt-24">
        <h2 className="text-2xl font-bold mb-4">Sem dados de execução</h2>
        <p className="text-slate-500 mb-8">Parece que esta reunião ainda não foi executada no modo apresentação.</p>
        <Button onClick={() => navigate(`/meeting/${id}`)}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <button 
            onClick={() => navigate(`/meeting/${id}`)}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Voltar para o editor
          </button>
          <h1 className="text-4xl font-black tracking-tighter text-white">
            Relatório de <span className="text-primary italic">Execução</span>
          </h1>
          <p className="text-slate-400 mt-2 font-medium">{meeting?.title}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-white/10 hover:bg-white/5 gap-2">
            <Download size={16} /> Exportar PDF
          </Button>
          <Button className="bg-primary text-black hover:bg-primary/90 font-bold gap-2">
            <Share2 size={16} /> Compartilhar
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <Card className="bg-[#1a1f33] border-white/5 p-6 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Score da Reunião</div>
          <div className="text-5xl font-black text-primary mb-2">{stats.score}</div>
          <div className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">
            {stats.score > 90 ? 'Excelente' : stats.score > 70 ? 'Bom' : 'A melhorar'}
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duração Total</div>
              <div className="text-xl font-bold text-white">{Math.round(stats.totalActual)} min</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Planejado: <span className="text-white">{stats.totalPlanned} min</span>
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atraso Acumulado</div>
              <div className="text-xl font-bold text-white">{Math.round(stats.totalExceeded)} min</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-red-400 font-bold">{stats.exceededCount}</span> tópicos excederam o tempo
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eficiência</div>
              <div className="text-xl font-bold text-white">{stats.efficiency}%</div>
            </div>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
             <div 
               className="h-full bg-green-500 rounded-full" 
               style={{ width: `${stats.efficiency}%` }}
             />
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ações Facilitador</div>
              <div className="text-xl font-bold text-white">{stats.totalAdjustmentCount} ajustes</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Tempo recuperado/perdido: <span className={stats.totalAdjustments >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.totalAdjustments} min</span>
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <SkipForward size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tópicos Pulados</div>
              <div className="text-xl font-bold text-white">{stats.totalSkipped}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {stats.totalSkipped > 0 ? 'Foco na agilidade da pauta' : 'Todos os tópicos discutidos'}
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[#00e5ff10] rounded-lg text-primary">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Obrigatórios</div>
              <div className="text-xl font-bold text-white">{stats.requiredCount}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Total de {stats.optionalCount} participantes opcionais
          </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${stats.highRiskTopicsCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tópicos de Risco</div>
              <div className="text-xl font-bold text-white">{stats.highRiskTopicsCount}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {stats.highRiskTopicsCount > 0 ? 'Tópicos com excesso de convidados' : 'Público bem distribuído'}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <Card className="lg:col-span-2 bg-[#1a1f33] border-white/5 p-8">
           <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
             <TrendingUp size={20} className="text-primary" /> Planejado vs Real por Tópico
           </h3>
           <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} label={{ value: 'Minutos', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend />
                  <Bar dataKey="planejado" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Planejado" />
                  <Bar dataKey="real" fill="#10b981" radius={[4, 4, 0, 0]} name="Real" />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </Card>

        <Card className="bg-[#1a1f33] border-white/5 p-8">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
             <Zap size={20} className="text-primary" /> Insights Automáticos
          </h3>
          <div className="space-y-6">
            {insights.map((insight, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                   <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-[#1a1f33] border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <CheckCircle2 size={20} className="text-primary" /> Analise de Tópicos
           </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-8 py-4">Tópico</th>
                <th className="px-8 py-4">Participantes</th>
                <th className="px-8 py-4">Planejado</th>
                <th className="px-8 py-4">Real</th>
                <th className="px-8 py-4">Diff</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => {
                const item = items.find(i => i.id === log.topic_id);
                const actual = Number(log.actual_duration);
                const exceeded = Number(log.exceeded_time);
                const isExceeded = exceeded > 0;
                const pTime = log.planned_duration;
                const rTime = Math.round(actual * 10) / 10;
                const diff = Math.round((rTime - pTime) * 10) / 10;

                const tParticipants = topicParticipants.filter(tp => tp.topic_id === log.topic_id);
                const reqCount = tParticipants.filter(tp => tp.role === 'required').length;
                const optCount = tParticipants.filter(tp => tp.role === 'optional').length;
                const totalP = reqCount + optCount;
                const isHighRisk = reqCount > 5;

                return (
                  <tr key={log.id} className={`hover:bg-white/5 transition-colors ${log.skipped ? 'opacity-50' : ''}`}>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-white">{item?.title} {log.skipped && '(Pulado)'}</div>
                          <div className="text-[10px] text-slate-500">{log.topic_type === 'topic' ? 'Tópico' : 'Pausa'}</div>
                        </div>
                        {isHighRisk && (
                          <Badge variant="destructive" className="text-[10px] uppercase font-black px-2 h-5 bg-red-500 text-white border-none">Risco Alto</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-slate-500" />
                          <span className="text-sm font-bold text-white">{totalP}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">({reqCount}R / {optCount}O)</span>
                       </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-400">{pTime}m</td>
                    <td className="px-8 py-5 text-sm text-white font-mono">{log.skipped ? '0m' : `${rTime}m`}</td>
                    <td className={`px-8 py-5 text-sm font-mono ${log.skipped ? 'text-amber-500' : diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                      {log.skipped ? 'PULADO' : diff > 0 ? `+${diff}` : diff}m
                    </td>
                    <td className="px-8 py-5">
                       {log.skipped ? (
                          <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase">
                             <SkipForward size={12} /> Pulado
                          </div>
                       ) : isExceeded ? (
                         <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase">
                           <AlertTriangle size={12} /> Estourou
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase">
                           <CheckCircle2 size={12} /> No Tempo
                         </div>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="mt-12 text-center pb-24">
         <p className="text-slate-500 text-sm mb-6 uppercase tracking-widest font-black">Próximos Passos</p>
         <div className="flex justify-center gap-4">
            <Button size="lg" className="bg-white text-black hover:bg-slate-200 font-bold" onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => navigate(`/meeting/${id}`)}>
              Revisar Estrutura
            </Button>
         </div>
      </div>
    </div>
  );
}
