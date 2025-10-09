#!/bin/bash

echo "Testing monorepo services..."
echo ""

# Check Docker services
echo "1. Checking Docker services..."
if docker-compose ps > /dev/null 2>&1; then
    docker-compose ps
    echo ""
    
    # Check health status
    echo "2. Checking service health..."
    docker-compose ps | grep -q "healthy" && echo "✓ Services are healthy" || echo "✗ Services not healthy yet"
    echo ""
else
    echo "✗ Docker is not running. Please start Docker first."
    echo ""
fi

# Check if pnpm build works
echo "3. Testing build..."
if pnpm -w build > /dev/null 2>&1; then
    echo "✓ Build successful"
else
    echo "✗ Build failed"
fi
echo ""

echo "4. To start development servers, run:"
echo "   pnpm dev"
echo ""

echo "5. Services will be available at:"
echo "   - Web:    http://localhost:3000"
echo "   - API:    http://localhost:4000"
echo "   - Worker: (background process)"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
