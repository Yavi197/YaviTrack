
export interface Provider {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'ratc',
    name: 'RESONANCIA DE ALTA TECNOLOGÍA DEL CARIBE S.A.S.',
    address: 'CRA.12 No 27 - 43',
    phone: '789-44-79'
  },
  {
    id: 'la-esperanza',
    name: 'CLINICA LA ESPERANZA',
    address: 'Calle 12 #4-58, B/ Buenavista, Montería, CO',
    phone: '784-89-03'
  }
];
