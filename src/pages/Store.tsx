import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Gift, Check, ShoppingCart, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { usePauseTokens } from '@/hooks/usePauseTokens';
import { useGameStore } from '@/store/gameStore';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
interface TokenPackage {
  id: string;
  tokens: number;
  price: string;
  popular?: boolean;
  bestValue?: boolean;
}
const tokenPackages: TokenPackage[] = [{
  id: 'pack-20',
  tokens: 20,
  price: '$2.49'
}, {
  id: 'pack-50',
  tokens: 50,
  price: '$5.00',
  popular: true
}, {
  id: 'pack-100',
  tokens: 100,
  price: '$7.49',
  bestValue: true
}];
const Store = () => {
  const {
    toast
  } = useToast();
  const {
    worldKindnessCount
  } = useGameStore();
  const {
    pauseTokens,
    daysUntilFreeToken,
    canClaimFreeToken,
    totalTokensUsed,
    claimFreeToken,
    isLoading
  } = usePauseTokens();
  const [claimingFree, setClaimingFree] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const handleClaimFreeToken = async () => {
    setClaimingFree(true);
    const success = await claimFreeToken();
    if (success) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: {
          y: 0.6
        },
        colors: ['#2ECC71', '#27AE60', '#F1C40F', '#E74C3C']
      });
      toast({
        title: "Free token claimed! 🎉",
        description: "You received 1 free pause token!"
      });
    } else {
      toast({
        title: "Couldn't claim token",
        description: "Please try again later",
        variant: "destructive"
      });
    }
    setClaimingFree(false);
  };
  const handlePurchase = async (pkg: TokenPackage) => {
    setPurchasingId(pkg.id);

    // Simulate purchase delay (would connect to payment processor)
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
      title: "Coming Soon! 🛒",
      description: "Token purchases will be available soon. Enjoy your free weekly token!"
    });
    setPurchasingId(null);
  };
  return <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />
      
      <main className="container flex-1 py-8 px-4">
        {/* Header with token count */}
        <div className="text-center mb-8">
          <motion.div className="inline-flex items-center gap-3 bg-card rounded-full px-6 py-3 shadow-lg border border-border mb-4" initial={{
          opacity: 0,
          y: -20
        }} animate={{
          opacity: 1,
          y: 0
        }}>
            <Ticket className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold text-foreground">
              You have {isLoading ? '...' : pauseTokens} tokens 🎫
            </span>
          </motion.div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">Token Store</h1>
          <p className="text-muted-foreground">
            Pause tokens give you extra time to pass chains without breaking them
          </p>
          
          {totalTokensUsed > 0 && <p className="text-sm text-muted-foreground mt-2">
              You've used {totalTokensUsed} token{totalTokensUsed !== 1 ? 's' : ''} total
            </p>}
        </div>

        {/* Free Token Section */}
        <motion.div className="mb-8" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.1
      }}>
          <Card className={`border-2 ${canClaimFreeToken ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center mb-2">
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="flex items-center justify-center gap-2">
                Weekly Free Token
                {canClaimFreeToken && <Badge className="bg-primary text-primary-foreground animate-pulse">
                    Available!
                  </Badge>}
              </CardTitle>
              <CardDescription>
                Every user gets 1 free pause token each week
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {canClaimFreeToken ? <Button size="lg" className="w-full max-w-xs" onClick={handleClaimFreeToken} disabled={claimingFree}>
                  {claimingFree ? <>
                      <motion.div animate={{
                  rotate: 360
                }} transition={{
                  repeat: Infinity,
                  duration: 1
                }}>
                        <Sparkles className="h-5 w-5 mr-2" />
                      </motion.div>
                      Claiming...
                    </> : <>
                      <Gift className="h-5 w-5 mr-2" />
                      Claim Free Token
                    </>}
                </Button> : <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span>
                      Next free token in <strong className="text-foreground">{daysUntilFreeToken} day{daysUntilFreeToken !== 1 ? 's' : ''}</strong>
                    </span>
                  </div>
                  <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden mt-2">
                    <motion.div className="h-full bg-primary rounded-full" initial={{
                  width: 0
                }} animate={{
                  width: `${(7 - daysUntilFreeToken) / 7 * 100}%`
                }} transition={{
                  duration: 0.5
                }} />
                  </div>
                </div>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Purchase Packages */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground text-center mb-6">
            Need more tokens?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {tokenPackages.map((pkg, index) => <motion.div key={pkg.id} initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.2 + index * 0.1
        }}>
              <Card className={`relative overflow-hidden ${pkg.bestValue ? 'border-2 border-primary shadow-lg' : pkg.popular ? 'border-2 border-yellow-400' : 'border-border'}`}>
                {pkg.bestValue && <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Best Value
                  </div>}
                {pkg.popular && !pkg.bestValue && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Popular
                  </div>}
                
                <CardHeader className="text-center pt-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-3xl font-bold">{pkg.tokens}</CardTitle>
                  <CardDescription>Pause Tokens</CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <div className="text-2xl font-bold text-foreground mb-1">{pkg.price}</div>
                  
                  
                  <Button variant={pkg.bestValue ? 'default' : 'outline'} className="w-full" onClick={() => handlePurchase(pkg)} disabled={purchasingId === pkg.id}>
                    {purchasingId === pkg.id ? <>
                        <motion.div animate={{
                    rotate: 360
                  }} transition={{
                    repeat: Infinity,
                    duration: 1
                  }}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                        </motion.div>
                        Processing...
                      </> : <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Purchase
                      </>}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>)}
        </div>

        {/* Info Section */}
        <Card className="bg-secondary/30">
          <CardContent className="py-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              How Pause Tokens Work
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Use a token when you need more time to pass a chain</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Each token resets your chain's countdown back to 24 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Get 1 free token every week—no purchase required!</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Tokens never expire—save them for when you need them</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>;
};
export default Store;