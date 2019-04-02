import React, { useEffect, useState } from 'react';
import TopMenu from './TopMenu';

export default function Parent(props) {
  const [showChild, setShowChild] = useState(false);

  // Wait until after client-side hydration to show
  useEffect(() => {
    setShowChild(true);
  }, []);

  if (!showChild) {
    // You can show some kind of placeholder UI here
    return null;
  }

  return <TopMenu {...props} />;
}
