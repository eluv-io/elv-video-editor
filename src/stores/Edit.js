import {action, flow, observable} from "mobx";

class EditStore {
  @observable saving = false;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.saving = false;
  }

  @action.bound
  Save = flow(function * () {
    this.saving = true;


    // Collect metadata tracks and convert to metadata format
    // Collect other changes like title



    yield new Promise(resolve => setTimeout(resolve, 5000));

    this.saving = false;
  })
}

export default EditStore;
