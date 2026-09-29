const createMode = () => ({
  sources: [],
  jobs: null,
  history: { stack: [{ sources: [], jobs: null }], index: 0 }
});

const modes = { sheets: createMode(), loose: createMode() };
let uidCounter = 0;

export const state = {
  mode: 'sheets',
  viewMode: 'tabs',
  activeTab: 0,

  get current() { return modes[this.mode]; },
  get sources() { return this.current.sources; },
  set sources(list) { this.current.sources = list; },
  get jobs() { return this.current.jobs; },
  set jobs(list) { this.current.jobs = list; },
  get history() { return this.current.history; },

  nextUid: () => ++uidCounter
};
