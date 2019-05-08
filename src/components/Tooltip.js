import React from "react";
import PropTypes from "prop-types";
import { render } from "react-dom";

class ToolTip extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      toolTip: undefined,
    };

    this.DestroyToolTip = this.DestroyToolTip.bind(this);
    this.MoveToolTip = this.MoveToolTip.bind(this);
  }

  componentDidMount() {
    this.CreateToolTip(0, 0);
  }

  componentWillUnmount() {
    this.DestroyToolTip();
  }

  componentDidUpdate() {
    if(this.state.toolTip) {
      render(
        this.props.content,
        this.state.toolTip
      );

      this.ToggleTooltip(!!this.props.content);
    }
  }

  CreateToolTip() {
    if(this.state.toolTip) { return; }

    const toolTip = document.createElement("div");
    toolTip.style.position = "absolute";
    toolTip.className = "tooltip";
    toolTip.style.display = "none";
    document.body.appendChild(toolTip);

    this.setState({
      toolTip
    });
  }

  ToggleTooltip(show) {
    if(!this.state.toolTip) { return; }

    this.state.toolTip.style.display = show && !!this.props.content ? "block" : "none";
  }

  DestroyToolTip() {
    if(!this.state.toolTip) { return; }

    document.body.removeChild(this.state.toolTip);

    this.setState({
      toolTip: undefined
    });
  }

  MoveToolTip(x, y) {
    if(!this.state.toolTip) { return; }

    this.state.toolTip.style.left = Math.max(0, x - this.state.toolTip.offsetWidth / 2) + "px";
    this.state.toolTip.style.top = y + 30 + "px";
  }

  render() {
    return (
      React.cloneElement(
        React.Children.only(this.props.children),
        {
          onMouseEnter: () => this.ToggleTooltip(true),
          onMouseLeave: () => this.ToggleTooltip(false),
          onMouseMove: ({clientX, clientY}) => this.MoveToolTip(clientX, clientY)
        }
      )
    );
  }
}

ToolTip.propTypes = {
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node
  ]),
  children: PropTypes.node.isRequired
};

export default ToolTip;
