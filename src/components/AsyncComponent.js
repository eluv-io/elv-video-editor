import React from "react";
import PropTypes from "prop-types";
import {BallSpin} from "elv-components-js";

class AsyncComponent extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      error: undefined,
      loading: true
    };
  }

  componentDidMount() {
    this.props.Load()
      .then(() => this.setState({loading: false}))
      .catch(error => this.setState({error}));
  }

  render() {
    if(this.state.error) {
      return (
        <div className="async-component-error">
          Error: {this.state.error.message}
        </div>
      );
    }

    if(this.state.loading) {
      return (
        <div className="async-component-loading">
          <BallSpin />
        </div>
      );
    }

    return this.props.render ? this.props.render() : this.props.children;
  }
}

AsyncComponent.propTypes = {
  Load: PropTypes.func.isRequired,
  render: PropTypes.func,
  children: PropTypes.node
};

export default AsyncComponent;
