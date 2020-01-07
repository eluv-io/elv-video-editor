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
          linkPath: "video_tags/metadata_tags"
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

      // Start/end time clip
      const {startTime, endTime} = this.rootStore.trackStore.ClipInfo();
      const startFrame = this.rootStore.videoStore.videoHandler.TimeToFrame(startTime);
      const startTimeRat = this.rootStore.videoStore.videoHandler.FrameToRat(startFrame);
      const endFrame = this.rootStore.videoStore.videoHandler.TimeToFrame(endTime);
      const endTimeRat = this.rootStore.videoStore.videoHandler.FrameToRat(endFrame + 1);

      const offering = this.rootStore.videoStore.metadata.offerings.default;

      const metadataChanged = Object.keys(updatedMetadata).length > 0 || keysToDelete.length > 0;
      const clipChanged = offering.entry_point_rat !== startTimeRat || offering.exit_point_rat !== endTimeRat;

      // No difference between current tags and saved tags, or clip timing
      if(!metadataChanged && !clipChanged) {
        this.saving = false;
        this.saveFailed = false;
        return;
      }

      const {write_token} = yield client.EditContentObject({
        libraryId,
        objectId
      });

      if(metadataChanged) {
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
            path: "video_tags/metadata_tags",
            target: "MetadataTags.json",
            type: "file"
          }]
        });
      }

      if(clipChanged) {
        yield client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken: write_token,
          metadataSubtree: "offerings/default/entry_point_rat",
          metadata: startTimeRat
        });

        yield client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken: write_token,
          metadataSubtree: "offerings/default/exit_point_rat",
          metadata: endTimeRat
        });
      }

      const {hash} = yield client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: write_token
      });

      this.rootStore.menuStore.UpdateVersionHash(hash);

      yield this.rootStore.videoStore.ReloadMetadata();

      this.saveFailed = false;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(error);
      this.saveFailed = true;
    }

    this.saving = false;
  });

  @action.bound
  UploadMetadataTags = flow(function * ({metadataFile, metadataFileRemote, overlayFiles=[], overlayFilesRemote=[]}) {
    if(this.rootStore.videoStore.loading) {
      return;
    }

    const ReadFile = async file => await new Response(file).json();

    let metadataTags, overlayTags;

    // Read files and verify contents

    if(metadataFile) {
      metadataTags = yield ReadFile(metadataFile);

      if(!metadataTags.metadata_tags) {
        throw Error(`No metadata tags present in ${metadataFile.name}`);
      }
    }

    if(overlayFiles.length > 0) {
      overlayTags = yield Promise.all(
        Array.from(overlayFiles).map(async file => {
          const tags = await ReadFile(file);

          if(!tags.overlay_tags) {
            throw Error(`No overlay tags present in ${file.name}`);
          }

          const frames = Object.keys(tags.overlay_tags.frame_level_tags).map(frame => parseInt(frame));

          return {
            tags,
            startFrame: Math.min(...frames),
            endFrame: Math.max(...frames)
          };
        })
      );
    }

    if(!metadataTags && !overlayTags && !metadataFileRemote && overlayFilesRemote.length === 0) {
      return;
    }

    const client = this.rootStore.client;
    const libraryId = this.rootStore.menuStore.selectedObject.libraryId;
    const objectId = this.rootStore.menuStore.selectedObject.objectId;

    const {write_token} = yield client.EditContentObject({
      libraryId,
      objectId
    });

    // Local metadata tag files
    if(metadataTags) {
      // Upload and create a link to the metadata tag file
      const data = (new TextEncoder()).encode(JSON.stringify(metadataTags));
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

      yield client.CreateLinks({
        libraryId,
        objectId,
        writeToken: write_token,
        links: [{
          path: "video_tags/metadata_tags",
          target: "MetadataTags.json",
          type: "file"
        }]
      });
    }

    // Remote metadata tag files
    if(metadataFileRemote) {
      yield client.CreateLinks({
        libraryId,
        objectId,
        writeToken: write_token,
        links: [{
          path: "video_tags/metadata_tags",
          target: metadataFileRemote,
          type: "file"
        }]
      });
    }

    // Local overlay files
    if(overlayTags) {
      // Sort overlay tags by start frame
      overlayTags = overlayTags.sort((a, b) => a.startFrame < b.startFrame ? -1 : 1);

      // Clear any existing tags
      yield client.DeleteMetadata({
        libraryId,
        objectId,
        writeToken: write_token,
        metadataSubtree: "video_tags/overlay_tags"
      });

      // Upload and create a link to each overlay tag file
      for(let i = 0; i < overlayTags.length; i++) {
        const data = (new TextEncoder()).encode(JSON.stringify(overlayTags[i].tags));
        const filename = `OverlayTags-${(i + 1).toString().padStart(3, "0")}.json`;
        yield client.UploadFiles({
          libraryId,
          objectId,
          writeToken: write_token,
          fileInfo: [{
            path: filename,
            mime_type: "application/json",
            size: data.length,
            data: data.buffer
          }]
        });

        // TODO: Add start/end info to links
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/overlay_tags/${i}`,
            target: filename,
            type: "file"
          }]
        });
      }
    }

    // Remote overlay files
    if(overlayFilesRemote.length > 0) {
      for(let i = 0; i < overlayFilesRemote.length; i++) {
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/overlay_tags/${i}`,
            target: overlayFilesRemote[i],
            type: "file"
          }]
        });
      }
    }

    const {hash} = yield client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: write_token
    });

    // Reload video
    this.rootStore.menuStore.SelectVideo({
      libraryId,
      objectId,
      versionHash: hash
    });
  });
}

export default EditStore;
