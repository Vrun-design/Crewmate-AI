import React from 'react';
import {motion} from 'motion/react';
import {BrainCircuit, Database, FileText, Network, User} from 'lucide-react';
import type {MemoryNode} from '../../types';

interface MapNodeProps {
  top: string;
  left: string;
  title: string;
  tokens: string;
  delay: number;
  active?: boolean;
  icon: React.ComponentType<{size?: number; className?: string}>;
}

function MapNode({top, left, icon: Icon, title, tokens, delay, active}: MapNodeProps): React.ReactNode {
  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{delay}}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group cursor-pointer"
      style={{top, left}}
    >
      <div
        className={`glass-panel p-3 rounded-xl flex items-center gap-3 w-48 transition-transform group-hover:scale-105 ${
          active ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''
        }`}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            active ? 'bg-blue-500/20 text-blue-500' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{title}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{tokens} tokens</div>
        </div>
      </div>
    </motion.div>
  );
}

interface MemoryMindMapProps {
  nodes: MemoryNode[];
}

function getMapNodes(nodes: MemoryNode[]) {
  const positions = [
    {top: '25%', left: '30%', icon: User},
    {top: '30%', left: '70%', icon: FileText},
    {top: '70%', left: '25%', icon: Database},
    {top: '65%', left: '75%', icon: Network},
  ] as const;

  return nodes.slice(0, 4).map((node, index) => ({
    ...positions[index],
    ...node,
  }));
}

export function MemoryMindMap({nodes}: MemoryMindMapProps): React.ReactNode {
  const mapNodes = getMapNodes(nodes);

  return (
    <div className="flex-1 relative bg-secondary/50 overflow-hidden flex items-center justify-center min-h-[500px]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <line x1="50%" y1="50%" x2="30%" y2="25%" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
        <line x1="50%" y1="50%" x2="70%" y2="30%" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
        <line x1="50%" y1="50%" x2="25%" y2="70%" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
        <line x1="50%" y1="50%" x2="75%" y2="65%" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
      </svg>

      <div className="relative w-full h-full max-w-4xl mx-auto">
        <motion.div
          initial={{scale: 0}}
          animate={{scale: 1}}
          transition={{type: 'spring', bounce: 0.5}}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-1 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <div className="w-full h-full rounded-full bg-foreground flex flex-col items-center justify-center text-background">
              <BrainCircuit size={32} className="mb-1 text-blue-400" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Core</span>
            </div>
          </div>
          <div
            className="absolute -inset-4 border border-blue-500/30 rounded-full animate-ping"
            style={{animationDuration: '3s'}}
          ></div>
        </motion.div>

        {mapNodes.map((node, index) => (
          <div key={node.id}>
            <MapNode
              top={node.top}
              left={node.left}
              icon={node.icon}
              title={node.title}
              tokens={node.tokens}
              delay={0.1 + index * 0.1}
              active={node.active}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
