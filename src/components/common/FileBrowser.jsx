import {observer} from "mobx-react-lite";
import {
  Button,
  Code,
  Container,
  Group,
  HoverCard,
  Modal,
  Progress,
  RingProgress,
  Text,
  TextInput,
  UnstyledButton
} from "@mantine/core";
import {Dropzone} from "@mantine/dropzone";
import { modals } from "@mantine/modals";
import {useForm} from "@mantine/form";
import {useEffect, useState} from "react";
import {rootStore, fileBrowserStore} from "@/stores/index.js";
import {DataTable} from "mantine-datatable";
import PrettyBytes from "pretty-bytes";
import {
  IconButton,
  CopyButton,
  LocalizeString,
  AsyncButton,
  LoaderImage,
  Confirm
} from "@/components/common/Common.jsx";
import UrlJoin from "url-join";
import {useDebouncedValue} from "@mantine/hooks";
import {ScaleImage} from "@/utils/Utils.js";

export const SortTable = ({sortStatus, AdditionalCondition}) => {
  return (a, b) => {
    if(AdditionalCondition && typeof AdditionalCondition(a, b) !== "undefined") {
      return AdditionalCondition(a, b);
    }

    if(sortStatus.columnAccessor.includes(".")) {
      const [root, accessor] = sortStatus.columnAccessor.split(".");
      a = a[root]?.[accessor];
      b = b[root]?.[accessor];
    } else {
      a = a[sortStatus.columnAccessor];
      b = b[sortStatus.columnAccessor];
    }

    if(typeof a === "number") {
      a = a || 0;
      b = b || 0;
    } else {
      a = a?.toLowerCase?.() || a || "";
      b = b?.toLowerCase?.() || b || "";
    }

    return (a < b ? -1 : 1) * (sortStatus.direction === "asc" ? 1 : -1);
  };
};


import {
  IconArrowBackUp as IconBackArrow,
  IconEditCircle,
  IconFileDownload,
  IconCircleCheck as IconDownloadCompleted,
  IconFolder as IconDirectory,
  IconFile,
  IconFiles,
  IconLockSquare as IconFileEncrypted,
  IconPhoto,
  IconTrashX as IconDelete,
  IconX,
  IconUpload
} from "@tabler/icons-react";

// Table showing the status of file uploads in the upload form
const UploadStatus = observer(({selectedFiles, fileStatus}) => {
  const [records, setRecords] = useState([]);
  const [sortStatus, setSortStatus] = useState({columnAccessor: "progress", direction: "desc"});

  useEffect(() => {
    setRecords(
      selectedFiles
        .map(file => ({
            ...file,
            ...(fileStatus[file.filepath.replace(/^\//, "")] || {})
          })
        )
        .map(record => ({
          ...record,
          total: record.total || record.size,
          progress: (record.uploaded || 0) / (record.total || record.size) * 100
        }))
        .sort(
          // By default, surface currently uploading to the top of the list
          sortStatus.columnAccessor === "progress" && sortStatus.direction === "desc" ?
            (a, b) => {
              if(a.progress >= 100) {
                return 1;
              } else if(b.progress >= 100) {
                return -1;
              }

              return a.progress < b.progress;
            } : SortTable({sortStatus})
        )
    );
  }, [selectedFiles, fileStatus, sortStatus]);

  if(records.length === 0) {
    return null ;
  }

  const completedUploads = records.filter(record => record.progress >= 100).length;
  const completedSize = records.reduce((total, record) => total + (record.uploaded || 0), 0);
  const totalSize = records.reduce((total, record) => total + (record.total || 0), 0);
  return (
    <>
      <Group justify="space-between" mb="md">
        <Text fz="sm" fs="italic" fw={600}>Uploading {completedUploads} / {records.length}</Text>
        <Text fz="sm" fs="italic" fw={600}>{PrettyBytes(completedSize)} / {PrettyBytes(totalSize)} ({(completedSize / (totalSize || 1) * 100).toFixed(1)}%)</Text>
      </Group>
      <DataTable
        height={Math.max(250, window.innerHeight - 600)}
        highlightOnHover
        idAccessor="filename"
        records={records}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
        columns={[
          { accessor: "filename", title: rootStore.l10n.components.file_browser.columns.filename, sortable: true, render: ({filename}) => <Text style={{wordWrap: "anywhere"}}>{filename}</Text> },
          { accessor: "size", title: rootStore.l10n.components.file_browser.columns.size, sortable: true, render: ({total, size}) => PrettyBytes(total || size), width: 100 },
          {
            accessor: "uploaded",
            sortable: true,
            title: rootStore.l10n.components.file_browser.columns.progress,
            width: 150,
            render: ({progress}) => {
              return <Progress value={progress} />;
            }
          }
        ]}
      />
    </>
  );
});

// Form for uploading files
const UploadForm = observer(({objectId, path, Close}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileStatus = rootStore.fileBrowserStore.uploadStatus[objectId] || {};
  const uploading = fileBrowserStore.activeUploadJobs[objectId] > 0;

  return (
    <Modal
      opened
      centered
      size={800}
      onClose={uploading ? () => {} : Close}
      withCloseButton={!uploading}
      title={LocalizeString(rootStore.l10n.components.file_browser.upload_files, {path})}
    >
      <Container py="xl">
        <Dropzone
          multiple
          py={50}
          mx="auto"
          onDrop={async (files) => {
            if(!files || files.length === 0) { return; }

            let formattedFiles = [];

            setSelectedFiles([
              ...files.map(file => {
                const filename = (file.webkitRelativePath || file.name);
                const filepath = UrlJoin(path, filename.replace(/^\/+/g, ""));

                // Formatted request to send to client
                formattedFiles.push({
                  path: filepath,
                  type: "file",
                  mime_type: file.type,
                  size: file.size,
                  data: file,
                });

                // Add to list of files added
                return {
                  filename: (file.webkitRelativePath || file.name),
                  filepath,
                  size: file.size
                };
              }),
              ...selectedFiles
            ]);

            fileBrowserStore.UploadFiles({objectId, files: formattedFiles});
          }}
        >
          <Group justify="center" align="center">
            <Dropzone.Accept>
              <IconUpload />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFiles />
            </Dropzone.Idle>

            <Text size="xl" inline>
              { rootStore.l10n.components.file_browser.upload_instructions_drag }
            </Text>
          </Group>
          <Group justify="center" align="center">
            <Text size="sm" mt="sm" inline>
              { rootStore.l10n.components.file_browser.upload_instructions_click }
            </Text>
          </Group>
        </Dropzone>
        {
          selectedFiles.length === 0 ? null :
            <Container mt={50}>
              <UploadStatus path={path} selectedFiles={selectedFiles} fileStatus={fileStatus} />
            </Container>
        }
        <Group justify="end" mt={50}>
          <AsyncButton w={200} disabled={uploading} loading={uploading} onClick={Close}>
            { uploading ? "" : rootStore.l10n.components.actions.done }
          </AsyncButton>
        </Group>
      </Container>
    </Modal>
  );
});

// Form for creating directories
const CreateDirectoryForm = ({Create}) => {
  const [renaming, setRenaming] = useState(false);

  const form = useForm({
    initialValues: { filename: "" },
    validate: {
      filename: value => value ? null : rootStore.l10n.components.file_browser.validation.filename_must_be_specified
    }
  });

  return (
    <Container p={0}>
      <form
        onSubmit={form.onSubmit(values => {
          setRenaming(true);
          Create({filename: values.filename})
            .catch(error => {
              // eslint-disable-next-line no-console
              console.error(error);
              setRenaming(false);
            })
            .then(() => {
              modals.closeAll();
            });
        })}
      >
        <TextInput
          data-autofocus
          label={rootStore.l10n.components.file_browser.directory_name}
          {...form.getInputProps("filename")}
        />
        <Group mt="md">
          <AsyncButton
            w="100%"
            loading={renaming}
            type="submit"
          >
            { rootStore.l10n.components.actions.submit }
          </AsyncButton>
        </Group>
      </form>
    </Container>
  );
};

// Form for renaming files
const RenameFileForm = ({filename, Rename}) => {
  const [renaming, setRenaming] = useState(false);

  const form = useForm({
    initialValues: { newFilename: filename },
    validate: {
      newFilename: value => value ? null : rootStore.l10n.components.file_browser.validation.filename_must_be_specified
    }
  });

  return (
    <Container p={0}>
      <form
        onSubmit={form.onSubmit(values => {
          setRenaming(true);
          Rename({newFilename: values.newFilename})
            .catch(error => {
              // eslint-disable-next-line no-console
              console.error(error);
              setRenaming(false);
            })
            .then(() => {
              modals.closeAll();
            });
        })}
      >
        <TextInput
          data-autofocus
          label={rootStore.l10n.components.file_browser.new_filename}
          {...form.getInputProps("newFilename")}
        />
        <Group mt="md">
          <AsyncButton
            w="100%"
            loading={renaming}
            type="submit"
          >
            { rootStore.l10n.components.actions.submit }
          </AsyncButton>
        </Group>
      </form>
    </Container>
  );
};

const DownloadFileButton = ({objectId, path, filename, url, encrypted}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const commonProps = {
    color: "purple.6",
    label: LocalizeString(rootStore.l10n.components.file_browser.download, {filename})
  };

  if(encrypted) {
    return (
      <IconButton
        {...commonProps}
        icon={
          !downloading ? <IconFileDownload /> :
            progress >= 100 ?
              <IconDownloadCompleted /> :
              <RingProgress size={30} thickness={4} rootColor="gray.5" sections={[{value: progress, color: "purple.6"}]}/>
        }
        sx={{"&[data-loading]::before": { backgroundColor: "rgba(0,0,0,0)"}}}
        onClick={async () => {
          try {
            if(downloading) { return; }

            setDownloading(true);

            await fileBrowserStore.DownloadEncryptedFile({
              objectId,
              path,
              filename,
              callback: ({bytesFinished, bytesTotal}) => setProgress((bytesFinished || 0) / (bytesTotal || 1) * 100)
            });
          } catch(error) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }}
      />
    );
  }

  return (
    <IconButton
      {...commonProps}
      onClick={() => rootStore.OpenExternalLink(url, filename)}
      Icon={IconFileDownload}
    />
  );
};

const CopyFileLinkButton = ({filename, url}) => {
  return (
    <CopyButton
      label={LocalizeString(rootStore.l10n.components.file_browser.copy_link, {filename})}
      value={url}
    />
  );
};

const DeleteFileButton = ({filename, Delete}) => {
  const [deleting, setDeleting] = useState(false);

  return (
    <IconButton
      label={LocalizeString(rootStore.l10n.components.file_browser.delete, {filename})}
      color="red.5"
      loading={deleting}
      Icon={IconDelete}
      onClick={async () => {
        await Confirm({
          title: LocalizeString(rootStore.l10n.components.file_browser.delete, {filename}),
          text: `Are you sure you want to delete ${filename || "this file"}?`,
          onConfirm: () => {
            setDeleting(true);
            Delete()
              .finally(() => setDeleting(false));
          }
        });
      }}
    />
  );
};

const FileBrowserTable = observer(({
  objectId,
  extensions,
  multiple,
  path,
  filter,
  setPath,
  selectedRecords,
  setSelectedRecords
}) => {
  const [loading, setLoading] = useState(true);
  const [batchSize, setBatchSize] = useState(50);
  const [sortStatus, setSortStatus] = useState({columnAccessor: "filename", direction: "asc"});

  useEffect(() => {
    fileBrowserStore.LoadFiles({objectId})
      .then(() => setLoading(false));
  }, [objectId]);

  useEffect(() => {
    setBatchSize(50);
  }, [path]);

  let directory = fileBrowserStore.Directory({objectId, path})
    .filter(record => !filter || record.filename.toLowerCase().includes(filter))
    .sort(
      SortTable({
        sortStatus,
        AdditionalCondition: (a, b) => {
          // Unless specifically sorting on type, keep directories at the top of the list
          if(sortStatus.columnAccessor === "type") { return; }

          if(a.type === "directory" && b.type !== "directory") {
            return -1;
          } else if(a.type !== "directory" && b.type === "directory") {
            return 1;
          }
        }
      })
    )
    .map(file => ({...file, actions: ""}));

  const total = directory.length;
  directory = directory.slice(0, batchSize);

  const isRecordSelectable = ({encrypted, type, ext}) =>
    !encrypted && type !== "directory" && (!extensions || extensions.length === 0 || extensions.includes(ext?.toLowerCase()));

  return (
    <>
      <DataTable
        fetching={loading}
        onScrollToBottom={() => setBatchSize(batchSize + 50)}
        height={Math.max(250, window.innerHeight - 600)}
        onRowClick={({record}) => {
          if(record.type === "directory") {
            setPath(UrlJoin(path, record.filename));
          } else if(isRecordSelectable({type: record.type, ext: record.ext})) {
            if(selectedRecords.find(selectedRecord => selectedRecord.fullPath === record.fullPath)) {
              setSelectedRecords(selectedRecords.filter(selectedRecord => selectedRecord.fullPath !== record.fullPath));
            } else {
              setSelectedRecords(multiple ? [...selectedRecords, record] : [record]);
            }
          }
        }}
        highlightOnHover
        idAccessor="filename"
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
        records={directory}
        selectedRecords={selectedRecords}
        onSelectedRecordsChange={newSelectedRecords => {
          if(multiple) {
            setSelectedRecords(newSelectedRecords);
          } else {
            // Only allow one selection
            setSelectedRecords(newSelectedRecords.filter(newRecord => !selectedRecords.find(record => record.filename === newRecord.filename)));
          }
        }}
        // Hide select all if not multiple
        allRecordsSelectionCheckboxProps={{style: multiple ? {} : {display: "none"}}}
        // Hide directory selection checkbox
        getRecordSelectionCheckboxProps={({type}) => ({style: type === "directory" ? {display: "none"} : {}})}
        isRecordSelectable={isRecordSelectable}
        columns={[
          {
            accessor: "type",
            title: rootStore.l10n.components.file_browser.columns.type,
            width: 85,
            sortable: true,
            render: ({filename, type, encrypted, url}) => {
              if(type !== "image" || encrypted) {
                return (
                  type === "directory" ? <IconDirectory /> :
                    encrypted ? <IconFileEncrypted /> : <IconFile />
                );
              }

              return (
                <HoverCard position="right" offset={0} width={250} shadow="md">
                  <HoverCard.Target>
                    <Container p={0} style={{cursor: "pointer"}}>
                      <IconPhoto />
                    </Container>
                  </HoverCard.Target>
                  <HoverCard.Dropdown bg="var(--background-modal)" p="sm" >
                    <LoaderImage
                      alt={filename}
                      src={ScaleImage(url, 400)}
                      loaderAspectRatio={1}
                    />
                    <Text mt={5} ta="center" fz="xs">{filename}</Text>
                  </HoverCard.Dropdown>
                </HoverCard>
              );
            }
          },
          { accessor: "filename", title: rootStore.l10n.components.file_browser.columns.filename, sortable: true, render: ({filename}) => <Text style={{wordWrap: "anywhere"}}>{filename}</Text> },
          { accessor: "size", width: 100, title: rootStore.l10n.components.file_browser.columns.size, sortable: true, render: ({size}) => typeof size === "number" ? PrettyBytes(size) : "" },
          {
            accessor: "actions",
            title: rootStore.l10n.components.file_browser.columns.actions,
            textAlign: "center",
            width: 175,
            render: ({type, filename, url, publicUrl, fullPath, encrypted}) => {
              return (
                <Group gap={6} justify="center" wrap="none" onClick={event => event.stopPropagation()}>
                  {
                    type === "directory" ? null :
                      <IconButton
                        label={LocalizeString(rootStore.l10n.components.file_browser.rename, {filename})}
                        color="green.5"
                        Icon={IconEditCircle}
                        onClick={() =>
                          modals.open({
                            title: LocalizeString(rootStore.l10n.components.file_browser.rename, {filename}),
                            centered: true,
                            children:
                              <RenameFileForm
                                filename={filename}
                                Rename={async ({newFilename}) => {
                                  await fileBrowserStore.RenameFile({objectId, path, filename, newFilename});

                                  // If record was selected, remove from selection
                                  setSelectedRecords(selectedRecords.filter(selectedRecord => selectedRecord.fullPath !== fullPath));
                                }}
                              />
                          })
                        }
                      />
                  }
                  {
                    type === "directory" ? null :
                      <>
                        <DownloadFileButton
                          objectId={objectId}
                          path={path}
                          filename={filename}
                          encrypted={encrypted}
                          url={url}
                        />
                        {
                          encrypted ? null :
                            <CopyFileLinkButton
                              filename={filename}
                              url={publicUrl}
                            />
                        }
                      </>
                  }
                  <DeleteFileButton
                    filename={filename}
                    Delete={async () => {
                      await fileBrowserStore.DeleteFile({objectId, path, filename});

                      // If record was selected, remove from selection
                      setSelectedRecords(selectedRecords.filter(selectedRecord => selectedRecord.fullPath !== fullPath));
                    }}
                  />
                </Group>
              );
            },
          },
        ]}
      />
      <Text fw={500} fs="italic" fz="xs" my={5} ta="right">{total} result{total === 1 ? "" : "s"}</Text>
    </>
  );
});

const FileBrowser = observer(({store, objectId, multiple, title, extensions=[], opened=true, Close, Submit}) => {
  const [path, setPath] = useState("/");
  const [filter, setFilter] = useState("");
  const [debouncedFilter] = useDebouncedValue(filter, 200);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [saving, setSaving] = useState(false);
  let selectedObjectId = objectId;

  if(extensions === "image") {
    extensions = fileBrowserStore.imageTypes;
  } else {
    extensions = extensions.map(ext => ext?.toLowerCase());
  }

  const pathTokens = path.replace(/^\//, "").split("/");

  return (
    <Modal opened={opened} withCloseButton={false} onClose={() => {}} centered size={1000} title={title} padding="xl">
      { showUploadForm ? <UploadForm objectId={objectId} path={path} Close={() => setShowUploadForm(false)} /> : null }
      <Container px={0}>
        <Group mb="xs" align="center" gap="xs">
          <IconButton
            label={rootStore.l10n.components.file_browser.directory_back}
            disabled={path === "/"}
            variant="transparent"
            Icon={IconBackArrow}
            tooltipProps={{position: "bottom"}}
            onClick={() => setPath(UrlJoin("/", ...pathTokens.slice(0, -1)))}
          />
          {
            pathTokens.map((token, index) =>
              <Group gap="xs" key={`path-token-${token}-${index}`}>
                <Text>/</Text>
                <UnstyledButton onClick={() => setPath(UrlJoin("/", ...pathTokens.slice(0, index + 1)))}>
                  <Text fw={index === pathTokens.length - 1 ? 600 : 400}>
                    {token}
                  </Text>
                </UnstyledButton>
              </Group>
            )
          }
        </Group>
        <TextInput mb="md" label={rootStore.l10n.components.fabric_browser.filter} value={filter} onChange={event => setFilter(event.target.value)} />
        <Container px={0}>
          <FileBrowserTable
            objectId={selectedObjectId}
            multiple={multiple}
            extensions={extensions}
            path={path}
            filter={debouncedFilter}
            setPath={setPath}
            selectedRecords={selectedRecords}
            setSelectedRecords={setSelectedRecords}
          />
        </Container>
        <Group justify="space-between" mt="xs" px={5}>
          {
            !fileBrowserStore.files[selectedObjectId] ? <div /> :
              <Text fz="xs" fw={600}>
                { LocalizeString(rootStore.l10n.components.file_browser.browsing, {label: fileBrowserStore.objectNames[selectedObjectId] || selectedObjectId})}
              </Text>
          }
          {
            extensions.length === 0 ? null :
              <Text fz="xs" fs="italic">
                { LocalizeString(rootStore.l10n.components.file_browser.allowed_extensions, {extensions: extensions.join(", ")})}
              </Text>
          }
        </Group>
        {
          !multiple || selectedRecords.length === 0 ? null :
            <Container my="xs" p={0}>
              <Text mb="sm">Selected Files:</Text>
              <Container p={0}>
                {
                  selectedRecords.map(({fullPath}) =>
                    <Group key={`selected-file-${fullPath}`} gap="xs">
                      <IconButton
                        label={LocalizeString(rootStore.l10n.components.file_browser.remove_selection, {filename: fullPath})}
                        Icon={IconX}
                        onClick={() => setSelectedRecords(selectedRecords.filter(record => record.fullPath !== fullPath))}
                      />
                      <Code bg="transparent" style={{whiteSpace: "pre-wrap", wordBreak: "break-all"}} maw={800}>
                        { fullPath }
                      </Code>
                    </Group>
                  )
                }
              </Container>
            </Container>
        }
        <Group mt="xl" justify="space-between">
          <Group>
            <Button w={160} variant="outline" color="gray.5" autoContrast onClick={() => setShowUploadForm(true)}>
              { rootStore.l10n.components.actions.upload }
            </Button>
            <Button
              w={160}
              variant="outline"
              color="gray.5"
              autoContrast
              onClick={() =>
                modals.open({
                  title: rootStore.l10n.components.file_browser.create_directory,
                  centered: true,
                  children:
                    <CreateDirectoryForm
                      Create={async ({filename}) =>
                        await fileBrowserStore.CreateDirectory({objectId: selectedObjectId, path, filename})
                      }
                    />
                })
              }
            >
              { rootStore.l10n.components.file_browser.create_directory }
            </Button>
          </Group>
          <Group>
            <AsyncButton
              loading={saving === "cancel"}
              variant="subtle"
              color="gray.5"
              w={200}
              onClick={async () => {
                try {
                  setSaving("cancel");
                  await fileBrowserStore.Save({store, objectId, selectedObjectId});

                  Close();
                } catch(error) {
                  // eslint-disable-next-line no-console
                  console.error(error);
                  setSaving(false);
                }
              }}
            >
              { rootStore.l10n.components.actions.cancel }
            </AsyncButton>
            <AsyncButton
              loading={saving === "submit"}
              w={200}
              disabled={selectedRecords.length === 0}
              onClick={async () => {
                try {
                  setSaving("submit");

                  await fileBrowserStore.Save({store, objectId, selectedObjectId});

                  await rootStore.VersionHash({objectId: selectedObjectId});

                  const records = selectedRecords.map(record => ({
                    ...record,
                    publicUrl: rootStore.FabricUrl({
                      objectId: record.objectId,
                      path: UrlJoin("files", record.fullPath),
                      noWriteToken: true
                    })
                  }));

                  Submit(multiple ? records : records[0]);
                  Close();
                } catch(error) {
                  setSaving(false);
                }
              }}
            >
              { rootStore.l10n.components.actions.submit }
            </AsyncButton>
          </Group>
        </Group>
      </Container>
    </Modal>
  );
});

export const FileBrowserButton = observer(({fileBrowserProps, ...props}) => {
  const [show, setShow] = useState(false);

  return (
    <>
      <Button {...props} onClick={() => setShow(true)} />
      { show ? <FileBrowser {...fileBrowserProps} Close={() => setShow(false)} /> : null }
    </>
  );
});

export default FileBrowser;
