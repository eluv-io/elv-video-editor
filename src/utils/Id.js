// Incremental numerical IDs
let __id = 1;
export default {
  next: () => {
    __id++;
    return __id;
  },
  nextTag: () => {
    __id++;
    return "id-" +__id;
  }
};
