import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";

import {observer} from "mobx-react-lite";
import {
  AsyncButton,
  Confirm,
  FormMultiSelect,
  FormSelect,
  FormTextArea,
  FormTextInput,
  Icon,
  IconButton,
  Linkish,
  LoaderImage,
  Modal,
  ProgressModal, StyledButton
} from "@/components/common/Common.jsx";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, CSVtoList, ScaleImage, SP} from "@/utils/Utils.js";
import {Button, LoadingOverlay, Tooltip} from "@mantine/core";
import {LibraryBrowser} from "@/components/nav/Browser.jsx";
import {browserStore, editStore, groundTruthStore} from "@/stores/index.js";
import FileBrowser from "@/components/common/FileBrowser.jsx";
import {EntityCardMenu, EntityListItem} from "@/components/common/EntityLists.jsx";

import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import AddIcon from "@/assets/icons/v2/add.svg";
import DragIcon from "@/assets/icons/drag.svg";
import ListIcon from "@/assets/icons/v2/list.svg";
import SaveIcon from "@/assets/icons/v2/save.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import ImageIcon from "@/assets/icons/picture.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import CheckmarkIcon from "@/assets/icons/check-circle.svg";
import ExclamationPointIcon from "@/assets/icons/v2/exclamation.svg";
import AISparkleIcon from "@/assets/icons/v2/ai-sparkle1.svg";

const S = CreateModuleClassMatcher(GroundTruthStyles);

const EntityOption = ({option, checked}) => {
  const entity = groundTruthStore.pools[option.poolId]?.metadata?.entities?.[option.value];

  if(!entity && option.value !== "automatic") {
    return null;
  }

  let imageUrl = AISparkleIcon;
  if(entity) {
    const image = (entity.sample_files || []).find(image => image.anchor) || (entity.sample_files || [])[0];
    imageUrl = ScaleImage(image?.link?.url, 175);
  }

  return (
    <Tooltip
      disabled={!imageUrl || option.value === "automatic"}
      label={
        <LoaderImage
          lazy
          src={imageUrl}
          className={S("entity-option__tooltip-image")}
          showWithoutSource
        />
      }
      openDelay={500}
      position="bottom-start"
      classNames={{
        tooltip: S("tooltip--transparent")
      }}
    >
      <div className={S("entity-option", checked ? "entity-option--selected" : "")}>
        <div className={S("entity-option__image-container")}>
          <LoaderImage
            lazy
            src={imageUrl}
            className={S("entity-option__image", option.value === "automatic" ? "entity-option__image--automatic" : "")}
            showWithoutSource
          />
        </div>
        <div className={S("entity-option__text")}>
          { entity?.label || option.label }
        </div>
      </div>
    </Tooltip>
  );
};

export const EntitySelect = ({poolId, entityId, showAutoOption, setEntityId, loading=false, ...props}) => {
  const [selectedEntityId, setSelectedEntityId] = useState(entityId);
  const pool = groundTruthStore.pools[poolId];

  useEffect(() => {
    setSelectedEntityId(entityId);
  }, [entityId]);

  useEffect(() => {
    setEntityId(selectedEntityId);
  }, [selectedEntityId]);

  if(!pool?.metadata) {
    return null;
  }

  return (
    <div key={poolId} className={S("form__input-container")}>
      <LoadingOverlay visible={loading} />
      <FormSelect
        searchable
        limit={100}
        label="Entity"
        value={selectedEntityId}
        onChange={value => setSelectedEntityId(value)}
        options={
          [
            showAutoOption ? {label: "<Automatic>", value: "automatic", poolId} : undefined,
            ...(
              Object.keys(pool?.metadata?.entities || {})
                .map(entityId =>
                  ({
                    label: pool?.metadata?.entities[entityId].label || entityId,
                    value: entityId,
                    poolId
                  })
                )
            )
          ].filter(option => option)
        }
        renderOption={EntityOption}
        classNames={{
          option: S("entity-option-wrapper")
        }}
        { ...props }
      />
    </div>
  );
};

const AttributeForm = observer(({
  attribute,
  dragging,
  StartDrag,
  EndDrag,
  Update,
  Remove,
  dragIndicatorBefore,
  dragIndicatorAfter,
}) => {
  const [ref, setRef] = useState(undefined);
  const [attributeInfo, setAttributeInfo] = useState({...attribute});

  const UpdateField = name => value => setAttributeInfo({
    ...attributeInfo,
    [name]: value?.target ? value.target.value : value
  });

  useEffect(() => {
    Update(attributeInfo);
  }, [attributeInfo]);

  const options = CSVtoList(attributeInfo.options);

  return (
    <div
      ref={setRef}
      className={S(
        "attribute-form",
        dragging ? "attribute-form--dragging" : "",
        dragIndicatorBefore ? "attribute-form--indicator-before" : "",
        dragIndicatorAfter ? "attribute-form--indicator-after" : ""
      )}
    >
      <div className={S("attribute-form__actions", "attribute-form__actions--left")}>
        <IconButton
          faded
          draggable
          onDragEnd={() => EndDrag(attribute)}
          onDragStart={event => {
            StartDrag(attribute);
            event.dataTransfer.setDragImage(ref, 0, 0);
          }}
          icon={DragIcon}
        />
      </div>
      <div className={S("attribute-form__dragging-name")}>{attributeInfo.key}</div>
      <div className={S("attribute-form__inputs")}>
        <label className={S("attribute-form__inputs-label")}>Attribute</label>
        <FormTextInput
          label="Label"
          placeholder="Enter Field Label"
          required
          value={attributeInfo.key}
          onChange={UpdateField("key")}
        />
        <div className={S("attribute-form__options-wrapper")}>
          <FormTextArea
            label="Options"
            placeholder="Enter possible values for this field, separated by commas."
            value={attributeInfo.options}
            onChange={UpdateField("options")}
            minRows={1}
          />
          <IconButton
            label={
              options.length === 0 ? null :
                <div>
                  {options.map((o, i) => <div key={i}>{o}</div>)}
                </div>
            }
            disabled={options.length === 0}
            icon={ListIcon}
            small
            className={S("attribute-form__options")}
          />
        </div>
      </div>
      <div className={S("attribute-form__actions", "attribute-form__actions--right")}>
        <IconButton
          icon={DeleteIcon}
          faded
          onClick={async () => await Confirm({
            title: "Remove Attribute",
            text: "Are you sure you want to remove this attribute field?",
            onConfirm: () => Remove()
          })}
        />
      </div>
    </div>
  );
});

function GetDragIndicatorPosition(event, container) {
  const draggableElements = Array.from(container.children);

  const y = event.clientY;

  const index = draggableElements.reduce((closest, child, index) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child, index };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).index;

  return typeof index === "undefined" || index < 0 ? draggableElements.length : index;
}

// Convert saved pool info to form fields
const PoolToFields = pool => {
  browserStore.ListLibraries({filter: pool.libraryId});

  return {
    libraryId: pool.libraryId,
    objectId: pool.objectId,
    name: pool.name,
    description: pool.description,
    model: pool.metadata.model_domain,
    attributes: pool.attributes
  };
};

export const GroundTruthPoolForm = observer(({pool, Close}) => {
  const [showLibraryBrowser, setShowLibraryBrowser] = useState(false);
  const [attributesRef, setAttributesRef] = useState(undefined);
  const [draggingIndex, setDraggingIndex] = useState(undefined);
  const [dragIndicatorIndex, setDragIndicatorIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dragging = typeof draggingIndex !== "undefined";
  const isNew = !pool;

  const [formData, setFormData] = useState(
    pool ? PoolToFields(pool) :
      {
        libraryId: "",
        name: "",
        description: "",
        model: Object.keys(groundTruthStore.domains)[0],
        attributes: []
      }
  );

  let errorMessages = [];
  if(!formData.libraryId) {
    errorMessages.push("Library must be specified");
  }
  if(!formData.name) {
    errorMessages.push("Name must be specified");
  }

  formData.attributes.map((attribute, index) => {
    if(!attribute.key) {
      errorMessages.push("Attribute name must be specified");
    } else if(formData.attributes.findIndex(a => a.key === attribute.key) !== index) {
      errorMessages.push(`Multiple attributes have the same label '${attribute.key}'`);
    }
  });

  const UpdateField = name => value => setFormData({...formData, [name]: value?.target ? value.target.value : value});

  return (
    <>
      <Modal
        title={
          <div className={S("ground-truth-form__header")}>
            <Icon icon={GroundTruthIcon} />
            <span>{isNew ? "New" : "Update"} Ground Truth Pool</span>
          </div>
        }
        alwaysOpened
        centered
        onClose={() => submitting ? null : Close()}
        withCloseButton={false}
        size={650}
      >
        <div
          onDragOver={event => {
            event.preventDefault();
            setDragIndicatorIndex(GetDragIndicatorPosition(event, attributesRef));
          }}
          onDrop={() => {
            const attribute = formData.attributes[draggingIndex];

            setFormData({
              ...formData,
              attributes: formData.attributes
                .filter((_, i) => i !== draggingIndex)
                .toSpliced(dragIndicatorIndex, 0, attribute)
            });

            setDraggingIndex(undefined);
          }}
          className={S("ground-truth-form")}
        >
          <FormTextInput
            label="Library"
            placeholder="Select a Library"
            required
            disabled={!isNew}
            value={browserStore.libraries?.[formData.libraryId]?.name || formData.libraryId}
            onChange={() => {}}
            onClick={() => setShowLibraryBrowser(true)}
          />
          <FormSelect
            label="Model"
            options={
              Object.keys(groundTruthStore.domains).map(key => ({
                label: groundTruthStore.domains[key],
                value: key
              }))
            }
            value={formData.model}
            onChange={UpdateField("model")}
          />
          <FormTextInput
            label="Name"
            placeholder="Enter a name"
            required
            value={formData.name}
            onChange={UpdateField("name")}
          />
          <FormTextArea
            label="Description"
            placeholder="Enter a description"
            value={formData.description}
            onChange={UpdateField("description")}
          />
          <div
            ref={setAttributesRef}
            className={S("ground-truth-form__attributes")}
          >
            {
              formData.attributes.map((attribute, index) =>
                <AttributeForm
                  dragging={dragging}
                  key={`attribute-${attribute.id}`}
                  attribute={{
                    ...attribute,
                    index
                  }}
                  dragIndicatorBefore={
                    dragging && dragIndicatorIndex === index && draggingIndex >= index
                  }
                  dragIndicatorAfter={
                    dragging && dragIndicatorIndex === index && draggingIndex < index
                  }
                  StartDrag={attribute => setDraggingIndex(attribute.index)}
                  EndDrag={() => setDraggingIndex(undefined)}
                  Remove={() => setFormData({...formData, attributes: formData.attributes.filter((_, i) => i !== index)})}
                  Update={updatedAttribute => setFormData({
                    ...formData,
                    attributes: formData.attributes.map((attribute, i) =>
                      i !== index ? attribute : updatedAttribute
                    )
                  })}
                />
              )
            }
          </div>

          <button
            onClick={() => setFormData({
              ...formData,
              attributes: [...formData.attributes, { id: Math.random(), key: "", options: "" }]
            })}
            className={S("ground-truth-form__add-attribute")}
          >
            <Icon icon={AddIcon} />
            <span>Add an Attribute</span>
          </button>

          {
            !error ? null :
              <div className={S("ground-truth-form__error")}>
                { error }
              </div>
          }

          <div className={S("ground-truth-form__actions")}>
            <Button
              disabled={submitting}
              w={150}
              variant="subtle"
              color="gray.5"
              onClick={() => Close()}
            >
              Cancel
            </Button>
            <AsyncButton
              color="gray.5"
              autoContrast
              w={150}
              disabled={errorMessages.length > 0}
              tooltip={
                errorMessages.length === 0 ? null :
                  errorMessages
                    .filter((x, i, a) => a.indexOf(x) == i)
                    .map(message => <div key={message}>{message}</div>)
              }
              onClick={async () => {
                setSubmitting(true);

                try {
                  const poolId =
                    isNew ?
                      await groundTruthStore.CreateGroundTruthPool(formData) :
                      await groundTruthStore.ModifyGroundTruthPool(formData);
                  Close(poolId);
                } catch (error) {
                  console.error(error);
                  setError("Failed to create ground truth pool. Please try again");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              { isNew ? "Create" : "Update" }
            </AsyncButton>
          </div>
        </div>
      </Modal>
      {
        !showLibraryBrowser ? null :
          <Modal withCloseButton={false} opened centered size={1000} onClose={() => setShowLibraryBrowser(false)}>
            <LibraryBrowser
              withFilterBar
              filterQueryParam="pool"
              title="Select a library for your new ground truth pool"
              Select={({libraryId}) => {
                setFormData({...formData, libraryId});
                setShowLibraryBrowser(false);
              }}
              className={S("ground-truth-form__browser")}
            />
          </Modal>
      }
      {
        !submitting ? null :
          <ProgressModal
            title={`${isNew ? "Creating" : "Updating"} ground truth pool...`}
            progress={groundTruthStore.saveProgress}
          />
      }
    </>
  );
});

export const AssetFile = observer(({poolId, assetFile, withEntitySelect, SetAnchor, Remove, Update}) => {
  const [checkLoaded, setCheckLoaded] = useState(false);
  const [entityLoaded, setEntityLoaded] = useState(false);
  const [entityId, setEntityId] = useState("");

  const qualityCheck = groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl];

  useEffect(() => {
    groundTruthStore.ValidateImageQuality({
      poolId,
      url: assetFile.publicUrl,
      label: assetFile.fullPath
    })
      .then(async () => {
        setCheckLoaded(true);

        if(withEntitySelect && groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl]?.pass) {
          const result = await groundTruthStore.LookupImage({
            poolId,
            url: assetFile.publicUrl
          });

          setEntityId(result?.matched_uuid?.[0] || entityId);
        }

        setEntityLoaded(true);
      })
      .finally(() => setCheckLoaded(true));
  }, [withEntitySelect]);

  useEffect(() => {
    Update({
      ...assetFile,
      entityId
    });
  }, [entityId]);

  return (
    <div className={S("ground-truth-form__assets-list-item")}>
      <EntityListItem
        key={`asset-${assetFile.key}`}
        image={assetFile.publicUrl || assetFile.url}
        label={assetFile.filename}
        contain
        small
        anchor={assetFile.anchor}
        actions={
          <>
            <IconButton
              icon={AnchorIcon}
              disabled={assetFile.anchor}
              faded
              label="Set as Entity Anchor Image"
              onClick={SetAnchor}
            />
            <IconButton
              icon={XIcon}
              faded
              label="Remove Asset"
              onClick={Remove}
            />
            <IconButton
              loading={!checkLoaded}
              label={qualityCheck?.reason}
              icon={qualityCheck?.fail ? ExclamationPointIcon : CheckmarkIcon}
              small
              onClick={
                !qualityCheck?.fail ? null :
                  () => Confirm({
                    title: "Override Quality Check",
                    text: "Are you sure you want to ignore the quality check for this asset?",
                    onConfirm: () => {
                      groundTruthStore.OverrideQualityCheck({key: assetFile.publicUrl});
                      Update(assetFile);
                    }
                  })
              }
              className={
                S(
                  "ground-truth-form__asset-indicator",
                  `ground-truth-form__asset-indicator--${qualityCheck?.fail ? "fail" : "pass"}`
                )
              }
            />
          </>
        }
      />
      {
        !withEntitySelect ? null :
          <EntitySelect
            poolId={poolId}
            entityId={entityId}
            loading={!entityLoaded}
            setEntityId={setEntityId}
          />
      }
    </div>
  );
});

export const AssetFiles = observer(({poolId, withEntitySelect, Update}) => {
  const [assetFiles, setAssetFiles] = useState([]);
  const [updateKey, setUpdateKey] = useState(0);
  const [showAssetFileBrowser, setShowAssetFileBrowser] = useState(false);

  useEffect(() => {
    Update(assetFiles);
  }, [assetFiles, updateKey]);

  return (
    <>
      <AsyncButton
        color="gray.1"
        autoContrast
        onClick={() => setShowAssetFileBrowser(true)}
      >
        Select Assets
      </AsyncButton>
      {
        assetFiles.length === 0 ? null :
          <div
            className={S("entity-list", "ground-truth-form__assets-list", withEntitySelect ? "ground-truth-form__assets-list--with-entity" : "")}>
            {
              assetFiles
                .sort((a, b) =>
                  // Failed items should show first
                  groundTruthStore.imageQualityCheckStatus[a.publicUrl]?.fail ? -1 :
                    groundTruthStore.imageQualityCheckStatus[b.publicUrl]?.fail ? 1 : 0
                )
                .map((assetFile, index) =>
                  <AssetFile
                    key={assetFile.key}
                    withEntitySelect={withEntitySelect}
                    poolId={poolId}
                    assetFile={assetFile}
                    SetAnchor={() => setAssetFiles(
                      assetFiles.map((assetFile, i) => ({...assetFile, anchor: i === index}))
                    )}
                    Remove={() => setAssetFiles(assetFiles.filter((_, i) => i !== index))}
                    Update={updatedAssetFile => {
                      let updatedAssetFiles = assetFiles;
                      const index = updatedAssetFiles.findIndex(file => file.fullPath === assetFile.fullPath);
                      updatedAssetFiles[index] = updatedAssetFile;
                      setAssetFiles(updatedAssetFiles);
                      setUpdateKey(Math.random());
                    }}
                  />
                )
            }
          </div>
      }
      {
        !showAssetFileBrowser ? null :
          <FileBrowser
            alwaysOpened
            title="Select Ground Truth Assets"
            objectId={poolId}
            multiple
            extensions="image"
            Submit={files =>
              setAssetFiles([
                ...files
                  // Filter duplicates
                  .filter(file =>
                    !assetFiles.find(assetFile => assetFile.fullPath === file.fullPath)
                  )
                  .map(file => ({
                    ...file,
                    key: `${poolId}-${file.fullPath}`
                  })),
                ...assetFiles
              ])
            }
            Close={() => setShowAssetFileBrowser(false)}
          />
      }
    </>
  );
});

export const GroundTruthMultiEntityAssetForm = observer(({poolId, title, Close}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [assetFiles, setAssetFiles] = useState([]);
  const [entityId, setEntityId] = useState("automatic");

  // Required to trigger re-render after entity check finishes
  const [, setUpdateKey] = useState(0);

  let errorMessages = [];

  if(
    assetFiles.find(assetFile =>
      groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl] &&
      !groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl]?.pass
    )
  ) {
    errorMessages.push("One or more assets failed validation. Please remove them before continuing.");
  } else if(entityId === "automatic" && !!assetFiles.find(assetFile => !assetFile.entityId)) {
    errorMessages.push("One or more assets does not have an entity selected.");
  }

  const checkingFiles = !!assetFiles.find(assetFile =>
    !groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl]
  );

  return (
    <Modal
      title={
        <div className={S("ground-truth-form__header")}>
          <Icon icon={GroundTruthIcon} />
          <span>{title}</span>
        </div>
      }
      alwaysOpened
      centered
      onClose={() => submitting ? null : Close()}
      withCloseButton={false}
      size={650}
    >
      <div className={S("ground-truth-form")}>
        {/* Input here to prevent entity selection from automatically opening when the modal opens */}
        <input type="text" hidden/>
        <EntitySelect
          showAutoOption
          defaultDropdownOpened={false}
          poolId={poolId}
          entityId={entityId}
          setEntityId={newEntityId => setEntityId(newEntityId)}
          autoFocus={false}
        />
        <AssetFiles
          poolId={poolId}
          Update={updatedAssetFiles => {
            setAssetFiles(updatedAssetFiles);
            setUpdateKey(Math.random());
          }}
          withEntitySelect={entityId === "automatic"}
        />

        {
          !error ? null :
            <div className={S("ground-truth-form__error")}>
              {error}
            </div>
        }

        <div className={S("ground-truth-form__actions")}>
          <Button
            disabled={submitting}
            w={150}
            variant="subtle"
            color="gray.5"
            onClick={() => Close()}
          >
            Cancel
          </Button>
          <AsyncButton
            color="gray.5"
            autoContrast
            w={150}
            disabled={assetFiles.length === 0 || errorMessages.length > 0 || checkingFiles}
            tooltip={
              errorMessages.length === 0 ? null :
                errorMessages
                  .filter((x, i, a) => a.indexOf(x) == i)
                  .map(message => <div key={message}>{message}</div>)
            }
            onClick={async () => {
              setSubmitting(true);

              try {
                if(entityId === "automatic") {
                  groundTruthStore.AddMixedEntityAssets({poolId, files: assetFiles});
                } else {
                  groundTruthStore.AddAssets({poolId, entityId, files: assetFiles});
                }

                Close(true);
              } catch(error) {
                console.error(error);
                setError("Failed to add ground truth assets. Please try again");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Add Assets
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
});

export const GroundTruthEntityForm = observer(({
  title,
  poolId,
  entityId,
  showForm=false,
  showAssets=false,
  Close
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [assetFiles, setAssetFiles] = useState([]);

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = entityId && pool.metadata?.entities?.[entityId];
  const isNew = !entity;

  const attributeConfig = pool?.metadata?.entity_data_schema?.properties || {};

  let initialAttributes = {};
  Object.keys(attributeConfig).forEach(attributeKey =>
    initialAttributes[attributeKey] = entity?.meta?.[attributeKey] || ""
  );

  const [formData, setFormData] = useState(
    entity ? { ...entity, meta: initialAttributes } :
      {
        label: "",
        description: "",
        meta: initialAttributes,
        sample_files: []
      }
  );

  let errorMessages = [];
  const matchingLabelEntity = Object.values(pool?.metadata?.entities || {})
    .find((e, index) => (!entity || entity.index !== index) && e.label?.toLowerCase() === formData.label?.toLowerCase());

  if(!formData.label) {
    errorMessages.push("Label must be specified");
  } else if(showForm && matchingLabelEntity) {
    errorMessages.push("An entity with this label already exists");
  }

  const anchorImageUrl =
    assetFiles.find(assetFile => assetFile.anchor)?.publicUrl ||
    entity?.sample_files.find(asset => asset.anchor)?.link?.url ||
    entity?.sample_files?.[0]?.link?.url ||
    assetFiles[0]?.publicUrl;

  if(
    assetFiles.find(assetFile =>
      groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl] &&
      !groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl]?.pass
    )
  ) {
    errorMessages.push("One or more assets failed validation. Please remove them before continuing.");
  }

  const checkingFiles = !!assetFiles.find(assetFile =>
    !groundTruthStore.imageQualityCheckStatus[assetFile.publicUrl]
  );

  return (
    <Modal
      title={
        <div className={S("ground-truth-form__header")}>
          <Icon icon={GroundTruthIcon} />
          <span>{title}</span>
        </div>
      }
      alwaysOpened
      centered
      onClose={() => submitting ? null : Close()}
      withCloseButton={false}
      size={650}
    >
      <div className={S("ground-truth-form")}>
        {
          !anchorImageUrl ? null :
            <div className={S("ground-truth-form__asset-image-container")}>
              <LoaderImage
                loaderAspectRatio={1}
                loaderHeight="100%"
                src={ScaleImage(anchorImageUrl, 500)}
                alt={formData.label}
                className={S("ground-truth-form__asset-image")}
              />
            </div>
        }

        {
          !showForm ? null :
            <>
            <FormTextInput
              label="Label"
              placeholder="Enter a label"
              required
              value={formData.label}
              onChange={event => setFormData({...formData, label: event.target.value})}
            />
            <FormTextArea
              label="Description"
              placeholder="Enter a description"
              value={formData.description}
              onChange={event => setFormData({...formData, description: event.target.value})}
            />
          </>
        }

        {
          Object.keys(attributeConfig).map(attributeKey =>
            attributeConfig[attributeKey]?.options?.length > 0 ?
              <FormMultiSelect
                key={`attr-${attributeKey}`}
                label={attributeKey}
                value={(formData.meta[attributeKey] || "").split(",").map(s => s.trim()).filter(s => s)}
                options={attributeConfig[attributeKey].options}
                onChange={values => setFormData({
                    ...formData,
                    meta: {
                      ...formData.meta,
                      [attributeKey]: values.join(",")
                    }
                  }
                )}
              /> :
              <FormTextInput
                key={`attr-${attributeKey}`}
                label={attributeKey}
                value={formData.meta[attributeKey]}
                onChange={event => setFormData({
                  ...formData,
                  meta: {...formData.meta, [attributeKey]: event.target.value}
                })}
              />
          )
        }

        {
          !showAssets ? null :
            <AssetFiles
              poolId={poolId}
              Update={setAssetFiles}
            />
        }

        {
          !error ? null :
            <div className={S("ground-truth-form__error")}>
              {error}
            </div>
        }

        <div className={S("ground-truth-form__actions")}>
          <Button
            disabled={submitting}
            w={150}
            variant="subtle"
            color="gray.5"
            onClick={() => Close()}
          >
            Cancel
          </Button>
          <AsyncButton
            color="gray.5"
            autoContrast
            w={150}
            loading={checkingFiles}
            disabled={errorMessages.length > 0 || checkingFiles}
            tooltip={
              errorMessages.length === 0 ? null :
                errorMessages
                  .filter((x, i, a) => a.indexOf(x) == i)
                  .map(message => <div key={message}>{message}</div>)
            }
            onClick={async () => {
              setSubmitting(true);

              try {
                const id =
                  isNew ?
                    await groundTruthStore.AddEntity({poolId, assetFiles, ...formData}) :
                    await groundTruthStore.ModifyEntity({poolId, entityId, assetFiles, ...formData});
                Close(id);
              } catch(error) {
                console.error(error);
                setError("Failed to create ground truth entity. Please try again");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {isNew ? "Create" : "Update"}
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
});

export const GroundTruthAssetForm = observer(({poolId, entityId, assetIndexOrId, Close}) => {
  const [error, setError] = useState("");

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = entityId && pool.metadata?.entities?.[entityId];
  const asset = groundTruthStore.GetGroundTruthAsset(entity, assetIndexOrId);

  const [formData, setFormData] = useState({
    label: asset.label || "",
    description: asset.description || "",
  });

  return (
    <Modal
      title={
        <div className={S("ground-truth-form__header")}>
          <Icon icon={GroundTruthIcon} />
          <span>Update Ground Truth Asset</span>
        </div>
      }
      alwaysOpened
      centered
      onClose={Close}
      withCloseButton={false}
      size={650}
    >
      <div className={S("ground-truth-form")}>
        <img
          src={asset.link?.url}
          alt={asset.label || asset.filename}
          className={S("ground-truth-form__asset-image")}
        />
        <FormTextInput
          label="Label"
          placeholder={asset.filename}
          value={formData.label}
          onChange={event => setFormData({...formData, label: event.target.value})}
        />
        <FormTextArea
          label="Description"
          placeholder="Enter a description"
          value={formData.description}
          onChange={event => setFormData({...formData, description: event.target.value})}
        />

        {
          !error ? null :
            <div className={S("ground-truth-form__error")}>
              { error }
            </div>
        }

        <div className={S("ground-truth-form__actions")}>
          <Button
            w={150}
            variant="subtle"
            color="gray.5"
            onClick={() => Close()}
          >
            Cancel
          </Button>
          <AsyncButton
            color="gray.5"
            autoContrast
            w={150}
            onClick={async () => {
              try {
                await groundTruthStore.ModifyAsset({poolId, entityId, assetIndexOrId, ...formData});
                Close(entityId);
              } catch (error) {
                console.error(error);
                setError("Failed to edit ground truth asset. Please try again");
              }
            }}
          >
            Update
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
});

export const GroundTruthAssetFileBrowser = observer(({poolId, entityId, assetIndexOrId, Close}) => {
  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId] || {};
  const asset = typeof assetIndexOrId !== "undefined" && groundTruthStore.GetGroundTruthAsset(entity, assetIndexOrId);

  let exampleLink, initialPath;
  if(asset) {
    exampleLink = asset.link?.["/"];
  } else if(entity) {
    exampleLink = [...(entity.sample_files || [])]
      ?.sort((a, b) => a.updated_at < b.updated_at ? 1 : -1)
      ?.[0]?.link?.["/"];
  }

  if(exampleLink) {
    initialPath = exampleLink.split("/files")[1].split("/").slice(0, -1).join("/");
  }

  return (
    <FileBrowser
      initialPath={initialPath}
      alwaysOpened
      title={
        asset ?
          "Replace Ground Truth Asset" :
          "Select Ground Truth Assets"
      }
      objectId={poolId}
      multiple={!asset}
      extensions="image"
      Submit={files => {
        if(asset) {
          // Updating single existing asset image
          groundTruthStore.ModifyAsset({poolId, entityId, assetIndexOrId, file: files});
        } else {
          // Adding multiple assets
          groundTruthStore.AddAssets({poolId, entityId, files});
        }
      }}
      Close={Close}
    />
  );
});

export const GroundTruthPoolSaveButton = observer(({icon, poolId, ...props}) => {
  const [saving, setSaving] = useState(false);

  const pool = groundTruthStore.pools[poolId] || {};

  if(!pool) { return null; }

  const Save = async event => {
    event.preventDefault();
    event.stopPropagation();

    await Confirm({
      title: "Save Ground Truth Pool",
      text: "Are you sure you want to save your changes to this ground truth pool?",
      onConfirm: async () => {
        setSaving(true);

        await groundTruthStore.SaveGroundTruthPool({poolId});

        setSaving(false);
      }
    });
  };

  const active = editStore.HasUnsavedChanges("groundTruth", poolId);

  return (
    <>
      {
        icon ?
          <IconButton
            {...props}
            icon={SaveIcon}
            disabled={!active}
            highlight={active}
            label="Save Ground Truth Pool"
            onClick={Save}
          /> :
          <StyledButton
            {...props}
            disabled={!active}
            icon={SaveIcon}
            onClick={Save}
          >
            Save Changes
          </StyledButton>
      }
      {
        !saving && !groundTruthStore.saveError ? null :
          <ProgressModal
            title="Saving Ground Truth Pool..."
            progress={groundTruthStore.saveProgress}
            error={groundTruthStore.saveError}
            Close={SP(() => {
              groundTruthStore.ClearSaveError();
              setSaving(false);
            })}
          />
      }
    </>
  );
});

export const GroundTruthEntityMenu = observer(({poolId, entityId, Update}) => {
  const [showEdit, setShowEdit] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId] || {};

  if(!entity) {
    return null;
  }

  return (
    <>
      <EntityCardMenu
        label="Manage Entity"
        actions={[
          { label: "Edit", icon: EditIcon, onClick: () => setShowEdit(true) },
          { label: "Add Assets", icon: ImageIcon, onClick: () => setShowBrowser(true) },
          {
            label: "Remove",
            icon: DeleteIcon,
            onClick: async () => {
              await Confirm({
                title: "Remove Entity",
                text: "Are you sure you want to remove this entity?",
                onConfirm: () => {
                  groundTruthStore.DeleteEntity({poolId, entityId});
                  Update();
                }
              });
            }
          },
        ]}
      >
        <Linkish onClick={() => setShowEdit(true)} className={S("card-menu__item")}>
          <Icon icon={EditIcon} /><span>Edit</span>
        </Linkish>
        <Linkish onClick={() => setShowBrowser(true)} className={S("card-menu__item")}>
          <Icon icon={ImageIcon} /><span>Add Assets</span>
        </Linkish>
        <div className={S("card-menu__separator")}/>
        <Linkish
          onClick={async () => {
            await Confirm({
              title: "Remove Entity",
              text: "Are you sure you want to remove this entity?",
              onConfirm: () => {
                groundTruthStore.DeleteEntity({poolId, entityId});
                Update();
              }
            });
          }}
          className={S("card-menu__item")}
        >
          <Icon icon={DeleteIcon} /><span>Remove</span>
        </Linkish>
      </EntityCardMenu>
      {
        !showEdit ? null :
          <GroundTruthEntityForm
            title="Update Ground Truth Entity"
            poolId={poolId}
            entityId={entityId}
            Close={() => {
              setShowEdit(false);
              Update();
            }}
          />
      }
      {
        !showBrowser ? null :
          <GroundTruthAssetFileBrowser
            poolId={poolId}
            entityId={entityId}
            Close={() => {
              setShowBrowser(false);
              Update();
            }}
          />
      }
    </>
  );
});

export const GroundTruthAssetMenu = observer(({poolId, entityId, assetIndexOrId, Update}) => {
  const [showEdit, setShowEdit] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId] || {};
  const asset = groundTruthStore.GetGroundTruthAsset(entity, assetIndexOrId);

  if(!asset) {
    return null;
  }

  return (
    <>
      <EntityCardMenu
        label="Manage Asset"
        actions={[
          { label: "Rename", icon: EditIcon, onClick: () => setShowEdit(true) },
          { label: "Replace Image", icon: ImageIcon, onClick: () => setShowReplace(true) },
          {
            label: "Make Anchor",
            icon: AnchorIcon,
            onClick: async () => {
              await Confirm({
                title: "Set Entity Anchor Image",
                text: "Are you sure you want to use this asset as the anchor image for this entity?",
                onConfirm: () => {
                  groundTruthStore.SetAnchorAsset({poolId, entityId, assetIndexOrId});
                  Update();
                }
              });
            }
          },
          { separator: true },
          {
            label: "Remove",
            icon: DeleteIcon,
            onClick: async () => {
              await Confirm({
                title: "Remove Asset",
                text: "Are you sure you want to remove this asset?",
                onConfirm: () => {
                  groundTruthStore.DeleteAsset({poolId, entityId, assetIndexOrId});
                  Update();
                }
              });
            }
          },
        ]}
      />
      {
        !showEdit ? null :
          <GroundTruthAssetForm
            poolId={poolId}
            entityId={entityId}
            assetIndexOrId={assetIndexOrId}
            Close={() => {
              setShowEdit(false);
              Update();
            }}
          />
      }
      {
        !showReplace ? null :
          <GroundTruthAssetFileBrowser
            poolId={poolId}
            entityId={entityId}
            assetIndexOrId={assetIndexOrId}
            Close={() => {
              setShowReplace(false);
              Update();
            }}
          />
      }
    </>
  );
});
