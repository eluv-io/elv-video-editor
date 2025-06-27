import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";

import {observer} from "mobx-react-lite";
import {
  AsyncButton,
  Confirm, FormSelect,
  FormTextArea,
  FormTextInput,
  Icon,
  IconButton, Linkish, LoaderImage,
  Modal,
  ProgressModal, StyledButton
} from "@/components/common/Common.jsx";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, CSVtoList, SP} from "@/utils/Utils.js";
import {Button, Menu, Tooltip} from "@mantine/core";
import {LibraryBrowser} from "@/components/nav/Browser.jsx";
import {browserStore, editStore, groundTruthStore} from "@/stores/index.js";
import FileBrowser from "@/components/common/FileBrowser.jsx";

import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import AddIcon from "@/assets/icons/v2/add.svg";
import DragIcon from "@/assets/icons/drag.svg";
import ListIcon from "@/assets/icons/v2/list.svg";
import SaveIcon from "@/assets/icons/v2/save.svg";
import MenuIcon from "@/assets/icons/v2/dots-vertical.svg";
import EditIcon from "@/assets/icons/Edit.svg";
import ImageIcon from "@/assets/icons/picture.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";

const S = CreateModuleClassMatcher(GroundTruthStyles);

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
                  // eslint-disable-next-line no-console
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

export const GroundTruthEntityForm = observer(({poolId, entityId, Close}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
  } else if(matchingLabelEntity) {
    errorMessages.push("An entity with this label already exists");
  }

  return (
    <Modal
      title={
        <div className={S("ground-truth-form__header")}>
          <Icon icon={GroundTruthIcon} />
          <span>{isNew ? "New" : "Update"} Ground Truth Entity</span>
        </div>
      }
      alwaysOpened
      centered
      onClose={() => submitting ? null : Close()}
      withCloseButton={false}
      size={650}
    >
      <div className={S("ground-truth-form")}>
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

        {
          Object.keys(attributeConfig).map(attributeKey =>
            attributeConfig[attributeKey]?.options?.length > 0 ?
              <FormSelect
                key={`attr-${attributeKey}`}
                label={attributeKey}
                value={formData.meta[attributeKey]}
                options={attributeConfig[attributeKey].options}
                onChange={value => setFormData({...formData, meta: {...formData.meta, [attributeKey]: value}})}
              /> :
              <FormTextInput
                key={`attr-${attributeKey}`}
                label={attributeKey}
                value={formData.meta[attributeKey]}
                onChange={event => setFormData({...formData, meta: {...formData.meta, [attributeKey]: event.target.value}})}
              />
          )
        }

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
                const id =
                  isNew ?
                    await groundTruthStore.AddEntity({poolId, ...formData}) :
                    await groundTruthStore.ModifyEntity({poolId, entityId, ...formData});
                Close(id);
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);
                setError("Failed to create ground truth entity. Please try again");
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
                // eslint-disable-next-line no-console
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

  return (
    <FileBrowser
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
            title="Saving Ground Truth Pool"
            progress={groundTruthStore.saveProgress}
            error={groundTruthStore.saveError}
            Close={() => {
              groundTruthStore.ClearSaveError();
              setSaving(false);
            }}
          />
      }
    </>
  );
});

const GroundTruthCardMenu = observer(({label, children}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Menu
      opened={showMenu}
      onChange={setShowMenu}
      shadow="md"
      position="top-start"
      zIndex={200}
    >
      <Menu.Target>
        <Tooltip label={label} disabled={showMenu} openDelay={500}>
          <button
            onClick={event => {
              event.stopPropagation();
              event.preventDefault();

              setShowMenu(!showMenu);
            }}
            className={S("entity-card__action", showMenu ? "entity-card__action--active" : "")}
          >
            <Icon icon={MenuIcon} />
          </button>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown p={0} w={200} bg="var(--background-toolbar)">
        <div className={S("card-menu")}>
          { children }
        </div>
      </Menu.Dropdown>
    </Menu>
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
      <GroundTruthCardMenu label="Manage Entity">
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
      </GroundTruthCardMenu>
      {
        !showEdit ? null :
          <GroundTruthEntityForm
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
      <GroundTruthCardMenu label="Manage Asset">
        <Linkish onClick={() => setShowEdit(true)} className={S("card-menu__item")}>
          <Icon icon={EditIcon} /><span>Rename</span>
        </Linkish>
        <Linkish onClick={() => setShowReplace(true)} className={S("card-menu__item")}>
          <Icon icon={ImageIcon} /><span>Replace Image</span>
        </Linkish>
        <Linkish
          disabled={asset.anchor}
          onClick={async () => {
            await Confirm({
              title: "Set Entity Anchor Image",
              text: "Are you sure you want to use this asset as the anchor image for this entity?",
              onConfirm: () => {
                groundTruthStore.SetAnchorAsset({poolId, entityId, assetIndexOrId});
                Update();
              }
            });
          }}
          className={S("card-menu__item")}
        >
          <Icon icon={AnchorIcon} /><span>Make Anchor</span>
        </Linkish>
        <div className={S("card-menu__separator")}/>
        <Linkish
          onClick={async () => {
            await Confirm({
              title: "Remove Asset",
              text: "Are you sure you want to remove this asset?",
              onConfirm: () => {
                groundTruthStore.DeleteAsset({poolId, entityId, assetIndexOrId});
                Update();
              }
            });
          }}
          className={S("card-menu__item")}
        >
          <Icon icon={DeleteIcon} /><span>Remove</span>
        </Linkish>
      </GroundTruthCardMenu>
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

export const EntityListItem = observer(({link, image, label, count, actions}) =>
  <Linkish to={link} className={S("entity-card", "entity-list-item")}>
    <div className={S("entity-card__image-container")}>
      {
        !image ?
          <div className={S("entity-card__image", "entity-card__image--blank")}>
            <Icon icon={ImageIcon}/>
          </div> :
          <LoaderImage
            width={100}
            src={image}
            loaderDelay={25}
            loaderAspectRatio={1}
            className={S("entity-card__image")}
          />
      }
    </div>
    <div className={S("entity-card__text")}>
      <Tooltip openDelay={500} label={label}>
        <div className={S("entity-card__title")}>
          <div className={S("ellipsis")}>
            {label}
          </div>
          {
            typeof count === "undefined" ? null :
              <div className={S("entity-card__count")}>({count})</div>
          }
        </div>
      </Tooltip>
    </div>
    <div onClick={SP()} className={S("entity-list-item__actions")}>
      { actions }
    </div>
  </Linkish>
);

export const EntityCard = observer(({link, image, label, count, actions}) =>
  <div className={S("entity-card")}>
    <Linkish
      to={link}
      className={S("entity-card__image-container")}
    >
      {
        !image ?
          <div className={S("entity-card__image", "entity-card__image--blank")}>
            <Icon icon={ImageIcon}/>
          </div> :
          <LoaderImage
            width={320}
            src={image}
            loaderDelay={25}
            loaderAspectRatio={1}
            className={S("entity-card__image")}
          />
      }
    </Linkish>
    <div className={S("entity-card__text")}>
      <Tooltip openDelay={500} label={label}>
        <div className={S("entity-card__title")}>
          <div className={S("ellipsis")}>
            {label}
          </div>
          {
            typeof count === "undefined" ? null :
              <div className={S("entity-card__count")}>({count})</div>
          }
        </div>
      </Tooltip>
      {
        !actions ? null :
          <div onClick={SP()} className={S("entity-card__actions")}>
            { actions }
          </div>
      }
    </div>
  </div>
);
