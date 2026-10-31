export type Difficulty = "beginner" | "intermediate" | "advanced";
export type VisualStyle =
  | "scientific"
  | "isometric"
  | "blueprint"
  | "textbook"
  | "sketch"
  | "futuristic";
export interface Component {
  id: string;
  name: string;
  description: string;
  function: string;
  visualDescription: string;
  deeperQuestion: string;
  details: string;
}
export interface Hotspot {
  componentId: string;
  x: number;
  y: number;
  confidence: number;
}
export interface LearningNode {
  id: string;
  parentId: string | null;
  depth: number;
  question: string;
  title: string;
  summary: string;
  category: string;
  difficulty: Difficulty;
  explanation: string;
  objectives: string[];
  components: Component[];
  relationships: { from: string; to: string; description: string }[];
  followUps: string[];
  caveats: string[];
  imageUrl: string;
  hotspots: Hotspot[];
  style: VisualStyle;
  source: "demo" | "ideogram";
  createdAt: string;
}
export interface TutorAnswer {
  answer: string;
  suggestions: string[];
  demo: boolean;
}
