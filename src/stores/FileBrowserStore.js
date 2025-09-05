import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";

class FileBrowserStore {
  files = {};
  objectNames = {};
  imageTypes = ["gif", "ico", "jpg", "jpeg", "png", "svg", "webp"];

  activeUploadJobs = {};
  uploadStatus = {};

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  Reset() {
    this.files = {};
    this.objectNames = {};
    this.activeUploadJobs = {};
    this.uploadStatus = {};
  }

  ClearCachedFiles(objectId) {
    delete this.files[objectId];
  }

  WriteToken({objectId}) {
    return this.writeInfo[objectId]?.write_token;
  }

  // Retrieve contents of the specified directory
  Directory({objectId, path="/"}) {
    let directory = this.files[objectId] || {};

    path
      .replace(/^\//, "")
      .split("/")
      .filter(pathElement => pathElement)
      .forEach(pathElement => directory = directory?.[pathElement]);

    const libraryId = this.rootStore.libraryIds[objectId];
    const writeToken = this.rootStore.editStore.WriteToken({objectId});

    // Transform from fabric file metadata
    return Object.keys(directory || {})
      .map(filename => {
        if(filename === ".") { return; }

        const file = directory[filename];

        if(file?.["."]?.type === "directory") {
          return {
            objectId,
            type: "directory",
            filename,
            fullPath: UrlJoin(path, filename),
            size: Object.keys(file).filter(key => key !== ".").length
          };
        } else if(file?.["."]) {
          const ext = filename.includes(".") ? filename.split(".").slice(-1)[0].toLowerCase() : "";
          return {
            objectId,
            type: this.imageTypes.includes(ext) ? "image" : "file",
            filename,
            fullPath: UrlJoin(path, filename),
            ext,
            url: this.rootStore.FabricUrl({libraryId, objectId, writeToken, path: UrlJoin("files", path, filename), auth: "private"}),
            publicUrl: this.rootStore.FabricUrl({libraryId, objectId, path: UrlJoin("files", path, filename), auth: "private"}),
            size: file["."].size,
            encrypted: file["."].encryption?.scheme === "cgck"
          };
        }
      })
      .filter(file => file);
  }

  LoadFiles = flow(function * ({objectId, force=false}) {
    if(this.files[objectId] && !force) {
      return;
    }

    const libraryId = yield this.rootStore.LibraryId({objectId});
    const writeToken = this.rootStore.editStore.WriteToken({objectId});

    // Ensure version hash is loaded so static urls can be generated
    this.rootStore.VersionHash({objectId});

    const metadata = (yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/",
      select: [
        "files",
        "public/name"
      ],
      produceLinkUrls: true
    })) || {};

    this.files[objectId] = metadata.files;
    this.objectNames[objectId] = metadata.public?.name || objectId;
  });

  CreateDirectory = flow(function * ({objectId, path, filename}) {
    const libraryId = yield this.rootStore.LibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    yield this.client.CreateFileDirectories({
      libraryId,
      objectId,
      writeToken,
      filePaths: [UrlJoin(path, filename)]
    });

    yield this.LoadFiles({objectId, force: true});
  });

  RenameFile = flow(function * ({objectId, path, filename, newFilename}) {
    const libraryId = yield this.rootStore.LibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    yield this.client.MoveFiles({
      libraryId,
      objectId,
      writeToken,
      filePaths: [{
        path: UrlJoin(path, filename),
        to: UrlJoin(path, newFilename)
      }]
    });

    yield this.LoadFiles({objectId, force: true});
  });

  DeleteFile = flow(function * ({objectId, path, filename}) {
    const libraryId = yield this.rootStore.LibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    yield this.client.DeleteFiles({
      libraryId,
      objectId,
      writeToken,
      filePaths: [
        UrlJoin(path, filename)
      ]
    });

    yield this.LoadFiles({objectId, force: true});
  });

  UploadFiles = flow(function * ({objectId, files}) {
    const libraryId = yield this.rootStore.LibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    this.activeUploadJobs[objectId] = (this.activeUploadJobs[objectId] || 0) + 1;

    try {
      yield this.client.UploadFiles({
        objectId,
        libraryId,
        writeToken,
        fileInfo: files,
        callback: uploadStatus => runInAction(() => {
          this.uploadStatus[objectId] = {
            ...(this.uploadStatus[objectId] || {}),
            ...uploadStatus
          };
        })
      });

      yield this.LoadFiles({objectId, force: true});
    } catch(error) {
       
      console.error(error);
    } finally {
      this.activeUploadJobs[objectId] -= 1;
    }
  });

  async DownloadEncryptedFile({objectId, path, filename, callback}) {
    try {
      const libraryId = await this.rootStore.LibraryId({objectId});
      const writeToken = await this.rootStore.editStore.WriteToken({objectId});

      const blob = await this.client.DownloadFile({
        libraryId,
        objectId,
        writeToken,
        filePath: UrlJoin(path, filename),
        format: "blob",
        callback
      });

      this.rootStore.OpenExternalLink(window.URL.createObjectURL(blob), filename);
    } catch(error) {
       
      console.error(error);
    }
  }

  Save = flow(function * ({objectId}) {
    yield this.rootStore.editStore.Finalize({objectId, commitMessage: "EVIE - Upload/Modify files"});
    yield this.rootStore.VersionHash({objectId, force: true});

    yield this.rootStore.videoStore.UpdateObjectVersion();
  });

  get client() {
    return this.rootStore.client;
  }

  get utils() {
    return this.rootStore.utils;
  }
}

export default FileBrowserStore;
