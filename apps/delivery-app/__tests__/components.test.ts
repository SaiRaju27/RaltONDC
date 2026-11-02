import App from '../App';
import { DeliveryDashboard } from '../DeliveryDashboard';
import { OnboardingFlow } from '../OnboardingFlow';

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
});

