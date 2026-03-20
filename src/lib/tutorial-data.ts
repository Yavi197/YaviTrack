
import type { UserRole } from './types';

export type TutorialStep = {
    title: string;
    description: string;
    image: string;
    imageHint: string;
    veoPrompt?: string;
};

export const tutorialData: Record<UserRole, TutorialStep[]> = {
    enfermero: [],
    tecnologo: [],
    transcriptora: [],
    administrador: [],
    adminisonista: []
};
