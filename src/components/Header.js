import React from "react";

class Header extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <header>
        <h1 className="header-text">
          My Favorite Movie - Director's Cut
        </h1>
      </header>
    );
  }
}

export default Header;
