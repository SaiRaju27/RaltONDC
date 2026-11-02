import App from '../App';
import { DeliveryDashboard } from '../DeliveryDashboard';
import { OnboardingFlow } from '../OnboardingFlow';
import { LiveTrackingMap } from '../LiveTrackingMap';

describe('UI Component Declarations Suite', () => {
  it('exports root App component function', () => {
    expect(typeof App).toBe('function');
  });

  it('exports DeliveryDashboard component', () => {
    expect(typeof DeliveryDashboard).toBe('function');
  });

  it('exports OnboardingFlow component', () => {
    expect(typeof OnboardingFlow).toBe('function');
  });

  it('exports LiveTrackingMap component', () => {
    expect(typeof LiveTrackingMap).toBe('function');
  });
});

