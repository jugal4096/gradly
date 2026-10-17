export interface Program {
    id: string;
    institutionId: string;
    name: string;
    shortName?: string;
    level: "DIPLOMA" | "UNDERGRADUATE" | "POSTGRADUATE" | "DOCTORATE";
    durationSemesters: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }