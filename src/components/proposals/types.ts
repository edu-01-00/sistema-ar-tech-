export interface WizardTest {
  id: string;
  name: string;
  method: string;
  unit: string;
  parameterCode: string;
  value: number;
  matrix: string;
}

export interface WizardCollectionPoint {
  id: string;
  name: string;
  matrix: string;
  tests: WizardTest[];
}

export interface WizardContact {
  id: string;
  name: string;
  role: string | null;
}

export interface WizardClient {
  id: string;
  corporateName: string;
  contacts: WizardContact[];
  collectionPoints: WizardCollectionPoint[];
}

export interface WizardTechnicalText {
  matrix: string;
  title: string;
  content: string;
}
