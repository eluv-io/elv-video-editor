// Incremental numerical IDs

let __id = 0;

class Id {
  static next(){
    __id++;
    return __id;
  }

  static nextTag(){
    __id++;
    return "id-" +__id;
  }
}

export default Id;
