import React from 'react';
import { findRenderedDOMComponentWithTag, renderIntoDocument } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { expect } from 'chai';
import App from '../App/App';

describe('App', () => {
  const mockStore = {
    route: {
      routes: []
    }
  };

  const renderer = renderIntoDocument(
    <MemoryRouter>
      <App {...mockStore} />
    </MemoryRouter>
  );

  it('should render correctly', () => {
    // eslint-disable-next-line no-unused-expressions
    expect(renderer).to.be.ok;
  });

  it('should render with a Header 1', () => {
    const text = findRenderedDOMComponentWithTag(renderer, 'h1').textContent;
    expect(text).to.be.a('string');
  });

  it('should render with a paragraph', () => {
    const text = findRenderedDOMComponentWithTag(renderer, 'p').textContent;
    expect(text).to.be.a('string');
  });
});
