import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";

import {observer} from "mobx-react-lite";
import {
  AsyncButton,
  Confirm, FormSelect,
  FormTextArea,
  FormTextInput,
  Icon,
  IconButton,
  Modal, ProgressModal
} from "@/components/common/Common.jsx";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher, CSVtoList} from "@/utils/Utils.js";
import {Button} from "@mantine/core";
import {LibraryBrowser} from "@/components/nav/Browser.jsx";
import {browserStore, groundTruthStore} from "@/stores/index.js";

import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import AddIcon from "@/assets/icons/v2/add.svg";
import DragIcon from "@/assets/icons/drag.svg";
import ListIcon from "@/assets/icons/v2/list.svg";

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
        <label className={S("attribute-form__inputs-label")}>Configurable Field</label>
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
            title: "Remove Configurable Field",
            text: "Are you sure you want to remove this configurable field?",
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
            <span>Add a Configurable Field</span>
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
                      await groundTruthStore.UpdateGroundTruthPool(formData);
                  Close(poolId);
                } catch (error) {
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
