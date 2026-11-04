// Rede8 pilot defaults. Applied only to a new store; existing data is preserved.
export const CLINIC_COUNTERS = [1, 2].map(id => ({
  id, name: `Guichê ${id}`, operatorName: '', currentTicket: null,
  status: 'open', categoryIds: [], stageIds: ['reception'], lastActiveAt: 0,
}))

export const CLINIC_CATEGORIES = [
  { id: 'normal', name: 'Atendimento normal', prefix: 'N', color: '#342E4E',
    stages: [{ id: 'reception', name: 'Recepção' }] },
  { id: 'priority', name: 'Atendimento prioritário', prefix: 'P', color: '#C84B62',
    stages: [{ id: 'reception', name: 'Recepção' }] },
]
