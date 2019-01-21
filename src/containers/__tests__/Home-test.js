import React from 'react';
import { findRenderedDOMComponentWithTag, renderIntoDocument } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { expect } from 'chai';
import Home from '../Home/Home';

describe('App', () => {
  const renderer = renderIntoDocument(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );

  it('should render correctly', () => {
    // eslint-disable-next-line no-unused-expressions
    expect(renderer).to.be.ok;
  });

  it('should render with a Header 2', () => {
    const text = findRenderedDOMComponentWithTag(renderer, 'h2').textContent;
    expect(text).to.be.a('string');
  });
});
