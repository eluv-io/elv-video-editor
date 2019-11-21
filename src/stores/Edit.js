import {action, flow, observable, toJS} from "mobx";
import {diff} from "deep-object-diff";
import {SortEntries} from "../utils/Utils";

class EditStore {
  @observable saving = false;
  @observable saveFailed = false;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.saving = false;
  }

  @action.bound
  Save = flow(function * () {
    if(this.saving || this.rootStore.videoStore.loading) { return; }

    this.saving = true;

    try {
      const client = this.rootStore.client;
      const libraryId = this.rootStore.menuStore.selectedObject.libraryId;
      const objectId = this.rootStore.menuStore.selectedObject.objectId;
      const originalVersionHash = this.rootStore.menuStore.selectedObject.versionHash;

      let metadata = {};
      try {
        metadata = yield client.LinkData({
          libraryId,
          objectId,
          versionHash: originalVersionHash,
          linkPath: "asset_metadata/tags"
        });

        metadata = metadata.metadata_tags || {};
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Unable to retrieve existing tags");
      }

      let newMetadata = {};
      let updatedMetadata = {};

      const metadataTracks = this.rootStore.trackStore.tracks.filter(track => track.trackType === "metadata");

      metadataTracks.forEach(track => {
        const entryMetadata = Object.values(track.entries).map(entry => ({
          ...entry.entry,
          text: entry.text,
          start_time: entry.startTime,
          end_time: entry.endTime,
        }));

        const originalMetadata = metadata[track.key] || {};

        const trackMetadata = {
          ...originalMetadata,
          label: track.label,
          tags: SortEntries(entryMetadata)
        };

        newMetadata[track.key] = trackMetadata;

        if(originalMetadata) {
          originalMetadata.tags = SortEntries(originalMetadata.tags || []);

          const trackDiff = diff(
            originalMetadata,
            trackMetadata
          );

          if(Object.keys(trackDiff).length === 0) {
            return;
          }
        }

        updatedMetadata[track.key] = trackMetadata;
      });

      const keys = metadataTracks.map(track => track.key);
      const keysToDelete = Object.keys(metadata)
        .filter(key => !keys.includes(key));

      // No difference between current tags and saved tags
      if(Object.keys(updatedMetadata).length === 0 && keysToDelete.length === 0) {
        this.saving = false;
        this.saveFailed = false;
        return;
      }

      const {write_token} = yield client.EditContentObject({
        libraryId,
        objectId
      });

      // Upload new JSON file
      newMetadata = {
        ...this.rootStore.videoStore.tags,
        metadata_tags: newMetadata
      };

      const data = (new TextEncoder()).encode(JSON.stringify(toJS(newMetadata)));
      yield client.UploadFiles({
        libraryId,
        objectId,
        writeToken: write_token,
        fileInfo: [{
          path: "MetadataTags.json",
          mime_type: "application/json",
          size: data.length,
          data: data.buffer
        }]
      });

      // Update link to tags
      yield client.CreateLinks({
        libraryId,
        objectId,
        writeToken: write_token,
        links: [{
          path: "asset_metadata/tags",
          target: "MetadataTags.json",
          type: "file"
        }]
      });

      const {hash} = yield client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: write_token
      });

      this.rootStore.menuStore.UpdateVersionHash(hash);

      this.saveFailed = false;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(error);
      this.saveFailed = true;
    }

    this.saving = false;
  })
}

export default EditStore;
