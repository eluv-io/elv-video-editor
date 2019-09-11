import {action, flow, observable} from "mobx";
import {diff} from "deep-object-diff";
import {SortEntries} from "../utils/Utils";
import UrlJoin from "url-join";

const appVersionTag = "eluvio_video_editor_save";

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

      const metadata = (yield client.ContentObjectMetadata({
        libraryId,
        objectId,
        versionHash: originalVersionHash,
        metadataSubtree: "metadata_tags"
      })) || {};

      const pruneLastVersion = (yield client.ContentObjectMetadata({
        libraryId,
        objectId,
        versionHash: originalVersionHash,
        metadataSubtree: appVersionTag
      })) || {};

      let updatedMetadata = {};

      const metadataTracks = this.rootStore.trackStore.tracks.filter(track => track.trackType === "metadata");
      metadataTracks.forEach(track => {
        const entryMetadata = Object.values(track.entries).map(entry => ({
          ...entry.entry,
          label: entry.label,
          text: entry.text,
          start_time: entry.startTime,
          end_time: entry.endTime,
        }));

        const originalMetadata = metadata[track.key] || {};

        const trackMetadata = {
          ...originalMetadata,
          name: track.label,
          entries: SortEntries(entryMetadata)
        };

        if(originalMetadata) {
          originalMetadata.entries = SortEntries(originalMetadata.entries || []);

          const trackDiff = diff(
            originalMetadata,
            trackMetadata
          );

          if (Object.keys(trackDiff).length === 0) {
            return;
          }
        }

        updatedMetadata[track.key] = trackMetadata;
      });

      const keys = metadataTracks.map(track => track.key);
      const keysToDelete = Object.keys(metadata)
        .filter(key => !keys.includes(key));


      if(Object.keys(updatedMetadata).length === 0 && keysToDelete.length === 0) {
        this.saving = false;
        this.saveFailed = false;
        return;
      }

      const {write_token} = yield client.EditContentObject({
        libraryId,
        objectId,
      });

      // Update changed metadata
      yield Promise.all(
        Object.keys(updatedMetadata).map(async key => {
          await client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken: write_token,
            metadataSubtree: UrlJoin("metadata_tags", key),
            metadata: updatedMetadata[key]
          });
        })
      );

      // Delete missing metadata keys
      yield Promise.all(
        keysToDelete.map(async key => {
          await client.DeleteMetadata({
            libraryId,
            objectId,
            writeToken: write_token,
            metadataSubtree: UrlJoin("metadata_tags", key)
          });
        })
      );

      yield client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: write_token,
        metadataSubtree: appVersionTag,
        metadata: true
      });

      const {hash} = yield client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: write_token
      });

      this.rootStore.menuStore.UpdateVersionHash(hash);

      if(pruneLastVersion) {
        yield client.DeleteContentVersion({
          libraryId,
          objectId,
          versionHash: originalVersionHash
        });
      }

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
